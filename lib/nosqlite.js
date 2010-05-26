(function(){
  var NoSQLite, _a, nsl_console, nsl_debug, sys, webdb_provider;
  var __hasProp = Object.prototype.hasOwnProperty;
  // NoSQLite - SQLite for Javascript
  // (c) 2010 John J. Wright
  // NoSQLite is freely distributable under the terms of the MIT license.
  // For all details and documentation:
  // http://github.com/mrjjwright
  //
  // -------------------------------------------------------------------
  // A library to make it as easy as possible to store and retrieve JS objects
  // from SQLite. Zero-configuration!
  // Attempts to work with JS objects as intelligently as possible in SQLite.
  if (!(typeof window !== "undefined" && window !== null) && (typeof require !== "undefined" && require !== null)) {
    // Running in a CommonJS environment like Node.js
    // A webdb_provider is an object that wraps
    // another SQLite driver with an HTML 5 web db interface
    webdb_provider = require("webdb_sqlite");
    sys = require("sys");
    require("underscore");
    nsl_debug = sys.debug;
  } else if ((typeof window !== "undefined" && window !== null)) {
    // Running in the browser
    //Assume that all the required libs are bundled into a single file
    nsl_console = console;
    if ((typeof (_a = window.openDatabase) !== "undefined" && _a !== null)) {
      webdb_provider = window;
    } else {
      throw Error("Unsupported browser.  Does not support HTML5 Web DB API.");
    }
  }
  NoSQLite = function(options) {
    this.options = {
      core_data_mode: false,
      // whether to check if String columns are JSON
      // that start with nsl_json:
      check_for_json: true,
      sync_mode: false
    };
    // setup some of the default filters
    this.filters = [];
    this.filters.push(this.json_text_to_obj);
    this.pre_save_hooks = [];
    this.post_save_hooks = [];
    if ((typeof options !== "undefined" && options !== null)) {
      _.extend(this.options, options);
    }
    // used for error handling
    this.NO_SUCH_TABLE = 0;
    this.NO_SUCH_COLUMN = 1;
    this.UNRECOGNIZED_ERROR = 99;
    this.options.sync_mode ? !(typeof window !== "undefined" && window !== null) ? (this.sync = new require("./nsl_sync").NSLSync(this)) : (this.sync = new NSLSync(this)) : null;
    return this;
  };
  // Creates a NoSQLite object
  // Pass in an optional Core Data compatible mode flag.
  // params:
  // * (optional) If set to `true` will create a core data compatible schema.
  // Opens a database
  // name: the name of a db, or the full path to a db file
  // options: (optional) the NoSQLite options
  // callback: (optional) a callback method to use if the call succeeded
  NoSQLite.prototype.open = function(name, options, callback) {
    callback = _.isFunction(options) ? options : null;
    if ((typeof options !== "undefined" && options !== null) && (typeof callback !== "undefined" && callback !== null)) {
      this.options = _.extend(this.options, options);
    }
    this.openDatabase(name, null, null, null, callback);
    return this;
  };
  // Opens the database
  // Name to be the complete path to the db if it makes sense
  // Also providers can ignore the version attribute
  NoSQLite.prototype.openDatabase = function(name, version, displayName, estimatedSize, callback) {
    this.db = webdb_provider.openDatabase(name, version, displayName, estimatedSize, function() {
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback();
      }
    });
    return this;
  };
  // A poss through to the underly db transaction
  // in case the user wants to execute their own transactions
  NoSQLite.prototype.transaction = function(start, failure, success) {
    return this.db.transaction(start, failure, success);
  };
  //# Core Methods #################################
  // Finds an object or objects in the db
  //
  // table is the table to search against
  // predicate is optional - if missing will return all rows
  //
  // Predicate syntax
  // --------------------------
  // {col: "foo"} -> where col = "foo"
  // {"col <": 3} -> where col < 3
  // Supported operators are sqlite where operators
  // {col1: "foo", "col >=": 12} -> where col1="foo" and col1 >= 12
  //
  // If the returned value is a string and starts with "json:"
  // then NoSQLite assumes it wrote out serialized JSON for a complex object
  // and will call JSON.parse on the attribute so your object comes back
  // the same way you put it in.  You can turn this off by setting
  // the nosqlite option: nosqlite.options.check_for_json = false
  // As always, we will call you back when everything is ready!
  NoSQLite.prototype.find = function(table, predicate, the_callback) {
    var callback, select, self;
    select = this.sql.select(table, predicate);
    self = this;
    callback = the_callback;
    if (_.isFunction(predicate)) {
      callback = predicate;
    }
    return self.db.transaction(function(transaction) {
      return transaction.executeSql(select.index_placeholder, select.bindings, function(transaction, srs) {
        var _b, _c, _d, _e, _f, filter, i, obj, res;
        res = [];
        _b = 0; _c = srs.rows.length - 1;
        for (i = _b; (_b <= _c ? i <= _c : i >= _c); (_b <= _c ? i += 1 : i -= 1)) {
          obj = srs.rows.item(i);
          // apply any filters to the obj
          _e = self.filters;
          for (_d = 0, _f = _e.length; _d < _f; _d++) {
            filter = _e[_d];
            try {
              obj = filter(obj);
            } catch (err1) {
              // ignore errors from filters
            }
          }
          res.push(obj);
        }
        return callback(null, res);
      }, function(transaction, err) {
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
      });
    });
  };
  // Stores an object or objects in SQLite described by the descriptor.
  //
  // The object descriptor should be an object, or array of objects
  // where each object has followig attributes:
  // table - the table to insert the obj
  // obj - a single obj or array of objects to insert into the table
  // after (optional) - a function to call after each row has been inserted
  // One table is created for the object with the name supplied in param table.
  // The create table statement is generated as follows:
  // * Strings are stored as text
  // * Numbers are stored as numbers, don't worry about differences between integer types, floats, etc...
  // * Dates are stored ISO 8601 date strings
  // * Other objects (arrays, complex objects) are simply stored as JSON.stringify text
  // As always, we'll call you back when everything is ready!
  NoSQLite.prototype.save_objs = function(obj_desc, callback) {
    var current_err, current_obj_desc, db, obj_descs, res, save_args, self;
    // we accept an array or a single obj_desc
    obj_descs = _.isArray(obj_desc) ? obj_desc : [obj_desc];
    self = this;
    db = this.db;
    //aggegrate_results
    res = {
      rowsAffected: 0
    };
    // a counter obj that keeps track of where we are at in proccesing
    current_err = undefined;
    current_obj_desc = {};
    save_args = [];
    save_args.push(obj_desc);
    save_args.push(save_hook);
    save_args.push(callback);
    return db.transaction(function(transaction) {
      var insert_objs;
      self.transaction = transaction;
      // queue up sqls for each of the objs
      // We build obj_descs for each obj to insert
      // Each obj description is a special obj where each key
      // is the name of a table in which to save the obj
      // and the value is the obj
      insert_objs = function(obj_descs) {
        var _b, _c, _d, _e, insert_sql, obj_counter;
        _b = []; _d = obj_descs;
        for (_c = 0, _e = _d.length; _c < _e; _c++) {
          obj_desc = _d[_c];
          _b.push((function() {
            obj_counter = 0;
            current_obj_desc = obj_desc;
            insert_sql = self.sql.insert(obj_desc.table, obj_desc.obj);
            return transaction.executeSql(insert_sql.index_placeholder, insert_sql.bindings, function(transaction, srs) {
              var _f;
              obj_counter += 1;
              current_obj_desc = obj_descs[obj_counter];
              res.rowsAffected += srs.rowsAffected;
              res.insertId = srs.insertId;
              if ((typeof (_f = current_obj_desc.after) !== "undefined" && _f !== null)) {
                return insert_objs(current_obj_desc.after(srs.insertId, obj_desc));
              }
            }, function(transaction, err) {
              obj_counter += 1;
              // we want the transaction error handler to be called
              // so we can try to fix the error
              current_err = err;
              current_obj_desc = obj_descs[obj_counter];
              return false;
            });
          })());
        }
        return _b;
      };
      return insert_objs(obj_descs, self.save_hooks);
    }, function(transaction, err) {
      return self.fixSave(err, current_obj_desc, callback, save_args);
    }, function(transaction) {
      // oddly browsers, don't call the method above
      // when an error occurs
      (typeof current_err !== "undefined" && current_err !== null) ? self.fixSave(current_err, current_obj_desc, callback, save_args) : null;
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, res);
      }
    });
  };
  // Tries to fix the current save automatically by
  // examing the SQLite error and doing the following:
  // creating the table if it doesn't exist
  // adding the column if it doesn't exist
  //
  // If the error was fixed successfully retries the current
  // failed transaction.
  // Else notifies the callback
  NoSQLite.prototype.fixSave = function(err, obj_desc, callback, save_args) {
    var _b, _c, errobj, fix_sql, self;
    if (!(typeof err !== "undefined" && err !== null)) {
      return null;
    }
    self = this;
    err = (typeof err !== "undefined" && err !== null) && (typeof (_b = err.message) !== "undefined" && _b !== null) ? err.message : null;
    errobj = this.parse_error(err);
    fix_sql = (function() {
      if ((_c = errobj.code) === this.NO_SUCH_TABLE) {
        return this.sql.create_table(errobj.table, obj_desc.obj).sql;
      } else if (_c === this.NO_SUCH_COLUMN) {
        return this.sql.add_column(obj_desc.table, errobj.column).sql;
      } else {
        return null;
      }
    }).call(this);
    if (!(typeof fix_sql !== "undefined" && fix_sql !== null)) {
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(err);
      }
    } else {
      this.db.transaction(function(transaction) {
        return transaction.executeSql(fix_sql);
      }, function(transaction, err) {
        if ((typeof callback !== "undefined" && callback !== null)) {
          return callback(err);
        }
      }, function(transaction) {
        // we fixed the problem, retry the tx
        return self.save.apply(self, save_args);
      });
    }
  };
  // Built-in filters
  // go through a key of an object and checks for String
  // attributes that start with "json: " and calls
  // JSON.parse on them
  NoSQLite.prototype.json_text_to_obj = function(obj) {
    var _b, key, val;
    _b = obj;
    for (key in _b) { if (__hasProp.call(_b, key)) {
      if (!(_.isString(obj[key]))) {
        continue;
      }
      if (obj[key].startsWith("json: ")) {
        val = obj[key].split("json: ")[1];
        obj[key] = JSON.parse(val);
      }
    }}
    return obj;
  };
  // Error Handling
  // ------------------------
  // Parses error into an internal error code
  NoSQLite.prototype.parse_error = function(err) {
    var errobj;
    errobj = {};
    if (err.indexOf("no such table") !== -1) {
      errobj.code = this.NO_SUCH_TABLE;
      errobj.table = err.split("table: ")[1];
    } else if (err.indexOf("no column named ") !== -1) {
      errobj.code = this.NO_SUCH_COLUMN;
      errobj.column = err.split("no column named ")[1].trim();
    } else {
      errobj.code = this.UNRECOGNIZED_ERROR;
    }
    return errobj;
  };

  String.prototype.trim = function() {
    return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1");
  };
  String.prototype.startsWith = function(str) {
    return this.indexOf(str) === 0;
  };
  if ((typeof window !== "undefined" && window !== null)) {
    NoSQLite.prototype.sql = sqlite_sql;
    window.nosqlite = new NoSQLite();
  } else {
    NoSQLite.prototype.sql = (require("./sqlite_sql")).sqlite_sql;
    exports.nosqlite = new NoSQLite();
  }
  // In a browser enviroment, the rest of the NoSQLite functions are
  // bundled below here in a single JS file
})();
