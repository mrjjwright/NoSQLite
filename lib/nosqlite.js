(function(){
  var NoSQLite, _a, nsl_console, nsl_debug, sqlite_provider, sys;
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
    // A nsl_sqlite_wrapper is an object that wraps
    // another SQLite driver with an HTML 5 web db interface
    sqlite_provider = require("webdb_sqlite");
    sys = require("sys");
    require("underscore");
    nsl_debug = sys.debug;
  } else if ((typeof window !== "undefined" && window !== null)) {
    // Running in the browser
    //Assume that all the required libs are bundled into a single file
    nsl_console = console;
    if ((typeof (_a = window.openDatabase) !== "undefined" && _a !== null)) {
      sqlite_provider = window;
    } else {
      throw Error("Unsupported browser.  Does not support HTML5 Web API.");
    }
  }
  NoSQLite = function(options) {
    this.options = {
      core_data_mode: false,
      safe_mode: false
    };
    if ((typeof options !== "undefined" && options !== null)) {
      _.extend(this.options, options);
    }
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
    if ((typeof options !== "undefined" && options !== null)) {
      this.options = _.extend(this.options, options);
    }
    this.openDatabase(name, null, null, null, callback);
    return this;
  };
  // Opens the database
  // Name to be the complete path to the db if it makes sense
  // Also providers can ignore the version attribute
  NoSQLite.prototype.openDatabase = function(name, version, displayName, estimatedSize, callback) {
    this.db = sqlite_provider.openDatabase(name, version, displayName, estimatedSize, function() {
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback();
      }
    });
    return this.db;
  };
  //# Core Methods #################################
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
          return transaction.executeSQL(insert_sql.index_placeholder, insert_sql.bindings, function(transaction, srs) {
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
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, res);
      }
    });
  };
  // Finds an object or objects in the SQLite by running a query
  // derived from the supplied predicate on the supplied table.
  //
  // Predicate syntax
  // --------------------------
  // The following is the supported predicate syntax:
  //
  // As always, we will call you back when everything is ready!
  NoSQLite.prototype.find = function(table, predicate, the_callback) {
    var callback, db, select, self;
    select = this.sql.select(table, predicate);
    db = this.db;
    self = this;
    callback = the_callback;
    if (_.isFunction(predicate)) {
      callback = predicate;
    }
    return db.execute(select.escaped, function(error, results) {
      if ((typeof error !== "undefined" && error !== null)) {
        return callback(error);
      }
      return callback(null, results);
    });
  };
  // Find the object in the database identified by the predicate
  // if it exists.	 Otherwise, saves it.
  // Use this method if you need to save stuff in SQLite if it's not already there.
  // This is useful for times you aren't sure if the object is already in the db.
  // and you don't have the rowid on the obj (othewise you could just do a save, which
  // does a insert or replace).
  // One e.g., syncing your db to some other data source.
  // As always with NoSQLite, if any SQL errors are thrown, such as the
  // the table not existing it will create them.
  //
  //  Passing in an array
  // --------------------------
  // You can pass in an array of objects to this method as well.
  // NoSQLite will try to find and save the first object passed first
  // in order to make sure the database isn't missing table or any columns.
  // If that works, NoSQLite will find or save the rest of them.
  // The supplied predicate will be used on each object, with the value
  // supplied from the objects in the array of course.
  // Just pass in a predicate template, NoSQLite will populate the predicate with
  // values from the corresponding object in the array.
  //  Returns to your callback
  // --------------------------
  // * an error if it occurs
  // * a simple string indicting success if object or objects didn't exist and were saved
  // * the object found or an array of objects found
  // As always, we will call you back when everything is ready!
  NoSQLite.prototype.find_or_save = function(table, predicate, obj, callback) {
    var find_or_save_one, first_obj, found, num_saved, self, the_predicate, the_rest;
    self = this;
    first_obj = _.isArray(obj) ? obj[0] : obj;
    if (_.isArray(obj)) {
      the_rest = obj.slice(1, obj.length + 1);
    }
    found = [];
    num_saved = 0;
    the_predicate = this.sql.populate_predicate(predicate, first_obj);
    find_or_save_one = function(table, predicate, obj, the_callback) {
      return self.find(table, predicate, function(err, results) {
        //debug "result of find are: " + inspect(results)
        if (!(typeof results !== "undefined" && results !== null) || ((typeof results !== "undefined" && results !== null) && _.isArray(results) && results.length === 0)) {
          // The error could just be that the table doesn't exist in which
          // save will take care of it.
          return self.insert_object(table, obj, function(err, result) {
            !(typeof err !== "undefined" && err !== null) ? num_saved += 1 : null;
            return the_callback(err, result);
          });
        } else if (_.isArray(results) && results.length > 0) {
          found.push(results[0]);
          return the_callback(null, results[0]);
        }
      });
    };
    return find_or_save_one(table, the_predicate, first_obj, function(err, result) {
      if ((typeof err !== "undefined" && err !== null)) {
        callback(err);
      }
      if ((typeof the_rest !== "undefined" && the_rest !== null)) {
        return _.each(the_rest, function(the_obj) {
          the_predicate = this.sql.populate_predicate(predicate, the_obj);
          return find_or_save_one(table, the_predicate, the_obj, function(err, result) {
            (typeof err !== "undefined" && err !== null) ? callback(err) : null;
            if (the_obj === _.last(the_rest)) {
              return callback(err, num_saved);
            }
          });
        });
      } else {
        return callback(null, result);
      }
    });
  };
  // Error Handling
  // ------------------------
  NoSQLite.NO_SUCH_TABLE = 0;
  NoSQLite.NO_SUCH_COLUMN = 1;
  NoSQLite.UNRECOGNIZED_ERROR = 99;
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
        return this.sql.create_table(tx.table, tx.obj).sql;
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
        return transaction.executeSQL(fix_sql);
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
