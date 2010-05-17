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
      throw Error("Unsupported browser.  Does not support HTML5 Web API.");
    }
  }
  NoSQLite = function(options) {
    this.options = {
      core_data_mode: false,
      safe_mode: false,
      // whether to check if String columns are JSON
      // that start with nsl_json:
      check_for_json: true
    };
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
  // and will call JSON.parse on the items so your object comes back
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
        var _b, _c, _d, _e, key, obj, val;
        if (self.options.check_for_json) {
          _c = srs.rows;
          for (_b = 0, _d = _c.length; _b < _d; _b++) {
            obj = _c[_b];
            _e = obj;
            for (key in _e) { if (__hasProp.call(_e, key)) {
              if (!(_.isString(obj[key]))) {
                continue;
              }
              if (obj[key].startsWith("json: ")) {
                val = obj[key].split("json: ")[1];
                obj[key] = JSON.parse(val);
              }
            }}
          }
        }
        return callback(null, srs.rows);
      }, function(transaction, err) {
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
      });
    });
  };
  // Stores an object or objects in SQLite.
  // If the table doesn't exist, NoSQLite will create the table for you.
  // If the objects already exist in the database they will be updated because
  // NoSQLite issues an "insert or replace"
  // One table is created for the object with the name supplied in param table.
  // One column is created for each top-level attribute of the object.
  // All columns are stored with SQLite type affinity "TEXT" except
  // dates and numeric Javascript types that are stored as "NUMERIC"
  // * Strings are stored as text
  // * Numbers are stored as numbers, don't worry about differences between integer types, floats, etc...
  // * Dates are stored as numbers, Unix epochs since 1970
  // * Booleans are stored as numbers, 1 for true or 0 for false
  // * Other objects (arrays, complex objects) are simply stored as JSON.stringify text
  // You can pass in an array of objects as well.	Each row will be inserted
  // As always, we'll call you back when everything is ready!
  NoSQLite.prototype.save = function(table, obj, callback) {
    var db, objs, res, self, tx;
    this.table = table;
    if (_.isArray(obj)) {
      objs = obj;
    }
    if (!_.isArray(obj)) {
      objs = [obj];
    }
    self = this;
    db = this.db;
    // An object that describes the current transaction
    // so that it can be restarted if need be
    tx = {
      table: table,
      obj: obj,
      callback: callback
    };
    //aggegrate_results
    res = {
      rowsAffected: 0
    };
    return db.transaction(function(transaction) {
      var _b, _c, _d, _e, insert_sql;
      self.transaction = transaction;
      // queue up sqls for each of the objs
      _b = []; _d = objs;
      for (_c = 0, _e = _d.length; _c < _e; _c++) {
        obj = _d[_c];
        _b.push((function() {
          tx.current_obj = obj;
          insert_sql = self.sql.insert(table, obj);
          return transaction.executeSql(insert_sql.index_placeholder, insert_sql.bindings, function(transaction, srs) {
            // maybe a post commit-hook
            res.rowsAffected += srs.rowsAffected;
            res.insertId = srs.insertId;
            return res.insertId;
          }, function(transaction, err) {
            // we want the transaction error handler to be called
            // so we can try to fix the error
            tx.err = err;
            return false;
          });
        })());
      }
      return _b;
    }, function(transaction, err) {
      return self.tryToFix(tx);
    }, function(transaction) {
      var _b;
      // oddly browsers, don't call the method above
      // when an error occurs
      (typeof (_b = tx.err) !== "undefined" && _b !== null) ? self.tryToFix(tx) : null;
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, res);
      }
    });
  };
  // Helper methods
  // Error Handling
  // ------------------------
  // Tries to fix the current transaction automatically by
  // examing the SQLite error and doing the following:
  // creating the table if it doesn't exist
  // adding the column if it doesn't exist
  //
  // If the error was fixed successfully retries the current
  // failed transaction.
  // Else notifies the callback
  NoSQLite.prototype.tryToFix = function(tx) {
    var _b, _c, _d, _e, _f, err, errobj, fix_sql, self;
    if (!(typeof tx !== "undefined" && tx !== null) || !(typeof (_b = tx.err) !== "undefined" && _b !== null)) {
      return null;
    }
    self = this;
    err = (typeof (_c = tx.err) !== "undefined" && _c !== null) && (typeof (_d = tx.err.message) !== "undefined" && _d !== null) ? tx.err.message : null;
    errobj = this.parse_error(err);
    fix_sql = (function() {
      if ((_e = errobj.code) === this.NO_SUCH_TABLE) {
        return this.sql.create_table(tx.table, tx.current_obj).sql;
      } else if (_e === this.NO_SUCH_COLUMN) {
        return this.sql.add_column(tx.table, errobj.column).sql;
      } else {
        return null;
      }
    }).call(this);
    if (!(typeof fix_sql !== "undefined" && fix_sql !== null)) {
      if ((typeof (_f = tx.callback) !== "undefined" && _f !== null)) {
        return tx.callback(err);
      }
    } else {
      this.db.transaction(function(transaction) {
        return transaction.executeSql(fix_sql);
      }, function(transaction, err) {
        var _g;
        if ((typeof (_g = tx.callback) !== "undefined" && _g !== null)) {
          return tx.callback(err);
        }
      }, function(transaction) {
        // we fixed the problem, retry the tx
        return self.save(tx.table, tx.obj, tx.callback);
      });
    }
  };
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
