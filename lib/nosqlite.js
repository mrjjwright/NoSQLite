(function(){
  var NSLCore, _a, nosqlite, nsl_console, nsl_debug, sys, webdb_provider;
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
  NSLCore = function(options) {
    this.options = {
      core_data_mode: false,
      // whether to check if String columns are JSON
      // that start with nsl_json:
      check_for_json: true
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
    return this;
  };
  // Creates a NoSQLite object
  // Pass in an optional Core Data compatible mode flag.
  // params:
  // * (optional) If set to `true` will create a core data compatible schema.
  // A poss through to the underly db transaction
  // in case the user wants to execute their own transactions
  NSLCore.prototype.transaction = function(start, failure, success) {
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
  NSLCore.prototype.find = function(table, predicate, the_callback) {
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
  // Saves an object or objects in SQLite.
  // A convenience method that wraps save_objs
  NSLCore.prototype.save = function(table, obj, callback) {
    var obj_desc;
    obj_desc = {
      table: table,
      objs: [obj]
    };
    return this.save_objs(obj_desc, callback);
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
  NSLCore.prototype.save_objs = function(obj_desc, callback) {
    var current_err, current_obj, current_obj_desc, db, obj_descs, res, save_args, save_func, self;
    // we accept an array or a single obj_desc
    obj_descs = _.isArray(obj_desc) ? obj_desc : [obj_desc];
    self = this;
    db = this.db;
    //aggegrate_results
    res = {
      rowsAffected: 0
    };
    // a counter obj that keeps track of where we are in proccesing
    current_err = undefined;
    current_obj_desc = {};
    current_obj = {};
    save_args = [];
    save_args.push(obj_desc);
    save_args.push(callback);
    save_func = arguments.callee;
    return db.transaction(function(transaction) {
      var do_save;
      self.transaction = transaction;
      // queue up sqls for each of the objs
      // We build obj_descs for each obj to insert
      // Each obj description is a special obj where each key
      // is the name of a table in which to save the obj
      // and the value is the obj
      do_save = function(obj_descs) {
        var _b, _c, _d, _e, _f, _g, _h, _i, i, insert_sql, j, obj, set_counters;
        i = 0;
        j = 0;
        // we have to count the callbacks as they come in
        // to match them up with the obj_descs and objs
        // we are managing (power of closures)
        set_counters = function() {
          j = j + 1;
          if (j === obj_desc.objs.length) {
            i = i + 1;
            j = 0;
            return j;
          }
        };
        _b = []; _d = obj_descs;
        for (_c = 0, _e = _d.length; _c < _e; _c++) {
          obj_desc = _d[_c];
          _b.push((function() {
            _f = []; _h = obj_desc.objs;
            for (_g = 0, _i = _h.length; _g < _i; _g++) {
              obj = _h[_g];
              _f.push((function() {
                insert_sql = self.sql.insert(obj_desc.table, obj);
                return transaction.executeSql(insert_sql.index_placeholder, insert_sql.bindings, function(transaction, srs) {
                  var _j, _k, _l, _m, _n, _o, _p, child_desc, child_obj;
                  current_obj_desc = obj_descs[i];
                  current_obj = current_obj_desc.objs[j];
                  set_counters();
                  res.rowsAffected += srs.rowsAffected;
                  res.insertId = srs.insertId;
                  if ((typeof (_p = current_obj_desc.children) !== "undefined" && _p !== null) && current_obj_desc.children.length > 0) {
                    // set the foreign key on the children
                    _k = current_obj_desc.children;
                    for (_j = 0, _l = _k.length; _j < _l; _j++) {
                      child_desc = _k[_j];
                      _n = child_desc.objs;
                      for (_m = 0, _o = _n.length; _m < _o; _m++) {
                        child_obj = _n[_m];
                        child_obj[child_desc.fk] = srs.insertId;
                      }
                    }
                    return do_save(current_obj_desc.children);
                  }
                }, function(transaction, err) {
                  // we want the transaction error handler to be called
                  current_err = err;
                  // so we can try to fix the error
                  current_obj_desc = obj_descs[i];
                  current_obj = current_obj_desc.objs[j];
                  set_counters();
                  return false;
                });
              })());
            }
            return _f;
          })());
        }
        return _b;
      };
      return do_save(obj_descs, self.save_hooks);
    }, function(transaction, err) {
      return self.fix_save(err, current_obj_desc.table, current_obj, callback, save_func, save_args);
    }, function(transaction) {
      // oddly browsers, don't call the method above
      // when an error occurs
      (typeof current_err !== "undefined" && current_err !== null) ? self.fix_save(current_err, current_obj_desc.table, current_obj, callback, save_func, save_args) : null;
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
  // failed transaction by calling fix_back with the save_args
  // Else notifies the callback
  NSLCore.prototype.fix_save = function(err, table, obj, callback, fixback, save_args) {
    var _b, _c, errobj, fix_sql, self;
    if (!(typeof err !== "undefined" && err !== null)) {
      return null;
    }
    self = this;
    err = (typeof err !== "undefined" && err !== null) && (typeof (_b = err.message) !== "undefined" && _b !== null) ? err.message : null;
    errobj = this.parse_error(err);
    fix_sql = (function() {
      if ((_c = errobj.code) === this.NO_SUCH_TABLE) {
        return this.sql.create_table(table, obj).sql;
      } else if (_c === this.NO_SUCH_COLUMN) {
        return this.sql.add_column(table, errobj.column).sql;
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
        if ((typeof fixback !== "undefined" && fixback !== null)) {
          return fixback.apply(self, save_args);
        } else if ((typeof callback !== "undefined" && callback !== null)) {
          return callback(err);
        } else {
          throw err;
        }
      });
    }
  };
  // Built-in filters
  // go through a key of an object and checks for String
  // attributes that start with "json: " and calls
  // JSON.parse on them
  NSLCore.prototype.json_text_to_obj = function(obj) {
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
  NSLCore.prototype.parse_error = function(err) {
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
  nosqlite = {
    // Opens a database
    // name: the name of a db, or the full path to a db file
    // options: (optional) the NoSQLite options
    // callback: (optional) a callback method to use if the call succeeded
    open: function(name, options, callback) {
      var NSLSync, _b, nsl;
      callback = _.isFunction(options) ? options : callback;
      if ((typeof (_b = typeof options === "undefined" || options == undefined ? undefined : options.sync_mode) !== "undefined" && _b !== null) === true) {
        !(typeof window !== "undefined" && window !== null) ? (NSLSync = require("./nsl_sync").NSLSync) : (NSLSync = window.NSLSync);
        nsl = new NSLSync(options);
      } else {
        nsl = new NSLCore(options);
      }
      nsl.db = webdb_provider.openDatabase(name, '1.0', 'Offline document storage', 5 * 1024 * 1024, function(db) {
        if ((typeof callback !== "undefined" && callback !== null)) {
          return callback(nsl);
        }
      });
      return nsl;
    }
  };
  if ((typeof window !== "undefined" && window !== null)) {
    NSLCore.prototype.sql = sqlite_sql;
    window.nosqlite = nosqlite;
    window.NSLCore = NSLCore;
  } else {
    NSLCore.prototype.sql = (require("./sqlite_sql")).sqlite_sql;
    exports.nosqlite = nosqlite;
    exports.NSLCore = NSLCore;
  }
  // In a browser enviroment, the rest of the NoSQLite functions are
  // bundled below here in a single JS file
})();
