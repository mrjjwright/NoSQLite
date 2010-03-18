(function(){
  var NO_SUCH_COLUMN, NO_SUCH_TABLE, NoSQLite, S4, UNRECOGNIZED_ERROR, guid, sql, uuid;
  require("underscore");
  sql = require("./sql");
  uuid = require("./uuid");
  // NoSQLite - SQLite for Javascript
  // ---------------------------------
  //
  // A library to make it as easy as possible to store and retrieve JS objects
  // from SQLite. Zero-configuration!
  // Attempts to store JS objects as intelligently as possible in SQLite.
  NoSQLite = function NoSQLite(db, options) {
    sys.debug("creating instance of NoSQLite");
    this.db = db;
    this.table_descriptions = [];
    this.options = {
      core_data_mode: false,
      no_guid: false
    };
    if ((typeof options !== "undefined" && options !== null)) {
      this.options = _.extend(this.options, options);
    }
    return this;
  };
  // Pass in a valid HTML 5 compatible SQLite object
  // Pass in an optional Core Data compatible mode flag.
  // params:
  // * A HTML 5 compatible JS object.
  // * (optional) If set to `true` will create a core data compatible schema.
  // Finds an object or objects in the SQLite by running a query
  // derived from the supplied predicate on the supplied table.
  //
  // Predicate syntax
  // --------------------------
  // The following is the supported predicate syntax:
  //
  // As always, we will call you back when everything is ready!
  NoSQLite.prototype.find = function find(table, predicate, callback) {
    var _a, _b, db, err, select, self;
    select = sql.select(table, predicate);
    db = this.db;
    self = this;
    table = table;
    predicate = predicate;
    this.hash_flag = true;
    try {
      return db.query(select.escaped, function(select) {
        return callback(null, select);
      });
    } catch (the_err) {
      debug("error on find: " + the_err);
      err = (typeof (_a = the_err.message) !== "undefined" && _a !== null) ? the_err.message : the_err;
      self.parse_error(err);
      if ((_b = self.errobj.code) === self.NO_SUCH_TABLE) {
        return callback("NoSQLite doesn't know about this table yet.  Either call save or create_table.");
      } else if (_b === self.NO_SUCH_COLUMN) {
        return callback("NoSQLite can create this column for you if you call create_table with an object with that property");
      } else {
        return callback(err);
      }
    }
  };
  // Find the object in the database identified by the predicate
  // if it exists.  Otherwise, saves it.
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
  NoSQLite.prototype.find_or_save = function find_or_save(table, predicate, obj, callback) {
    var find_or_save_one, first_obj, found, num_saved, self, the_predicate, the_rest;
    self = this;
    first_obj = _.isArray(obj) ? obj[0] : obj;
    if (_.isArray(obj)) {
      the_rest = obj.slice(1, obj.length + 1);
    }
    found = [];
    num_saved = 0;
    the_predicate = sql.populate_predicate(predicate, first_obj);
    find_or_save_one = function find_or_save_one(table, predicate, obj, the_callback) {
      return self.find(table, predicate, function(err, results) {
        //debug "result of find are: " + inspect(results)
        if (!(typeof results !== "undefined" && results !== null) || ((typeof results !== "undefined" && results !== null) && _.isArray(results) && results.length === 0)) {
          // The error could just be that the table doesn't exist in which
          // save will take care of it.
          return self.save(table, obj, function(err, result) {
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
      return (typeof the_rest !== "undefined" && the_rest !== null) ? _.each(the_rest, function(the_obj) {
        the_predicate = sql.populate_predicate(predicate, the_obj);
        return find_or_save_one(table, the_predicate, the_obj, function(err, result) {
          (typeof err !== "undefined" && err !== null) ? callback(err) : null;
          return the_obj === _.last(the_rest) ? callback(err, num_saved) : null;
        });
      }) : callback(null, result);
    });
  };
  // Stores an object or objects in SQLite even if the table doesn't exist.
  // NoSQLite will create the table for you.
  // One table is created for the object with the name supplied in param table.
  // One column is created for each top-level attribute of the object.
  // All columns are stored with SQLite type affinity "TEXT" except
  // dates and numeric Javascript types that are stored as "NUMERIC"
  // * Strings are stored as text
  // * Numbers are stored as numbers, don't worry about differences between integer types, floats, etc...
  // * Dates are stored as numbers, Unix epochs since 1970
  // * Booleans are stored as numbers, 1 for true or 0 for false
  // * Other objects (arrays, complex objects) are simply stored as JSON.stringify text
  // You can pass in an array of objects as well.  If over a certain limit,
  // NoSQLite will batch the inserts together using a SQLite import command
  // which is really fast.
  // If the objects already exist in the database NoSQL will overwrite them for you with an update
  // As always, we'll call you back when everything is ready!
  NoSQLite.prototype.save = function save(table, obj, callback) {
    var _a, _b, _c, _d, _e, _f, _g, array_of_inserts, db, errback, first_one, insert_into_db, inserts, o, process_rest, self, table_obj, the_obj;
    //augment object with guid unless options say not to
    if (this.options_no_guid === false) {
      if (!_.isArray(obj)) {
        obj.guid = guid();
      } else {
        _a = obj;
        for (_b = 0, _c = _a.length; _b < _c; _b++) {
          o = _a[_b];
          o.guid = guid();
        }
      }
    }
    inserts = [];
    if (_.isArray(obj)) {
      inserts = (function() {
        _d = []; _e = obj;
        for (_f = 0, _g = _e.length; _f < _g; _f++) {
          table_obj = _e[_f];
          _d.push(sql.insert(table, table_obj, this.options.core_data_mode));
        }
        return _d;
      }).call(this);
    }
    if (!_.isArray(obj)) {
      inserts.push(sql.insert(table, obj, this.options.core_data_mode));
    }
    the_obj = _.isArray(obj) ? obj[0] : obj;
    self = this;
    db = this.db;
    array_of_inserts = [inserts[0]];
    first_one = function first_one(tx) {
      try {
        (typeof tx !== "undefined" && tx !== null) ? db.query(inserts[0].escaped) : null;
        return !(typeof tx !== "undefined" && tx !== null) ? db.transaction(insert_into_db, null, process_rest) : null;
      } catch (error) {
        if ((typeof error !== "undefined" && error !== null)) {
          return errback(tx, error);
        }
      }
    };
    process_rest = function process_rest(tx) {
      if (inserts.length > 1) {
        //process the rest
        array_of_inserts = inserts.slice(1, inserts.length + 1);
        return db.transaction(insert_into_db, null, function(res) {
          if ((typeof callback !== "undefined" && callback !== null)) {
            return callback(null, "success");
          }
        });
      } else if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, "success");
      }
    };
    errback = function errback(tx, the_err) {
      var _h, _i, compensating_sql, err;
      err = (typeof the_err !== "undefined" && the_err !== null) && (typeof (_h = the_err.message) !== "undefined" && _h !== null) ? the_err.message : the_err;
      debug("received error: " + err);
      self.parse_error(err);
      compensating_sql = (function() {
        if ((_i = self.errobj.code) === NO_SUCH_TABLE) {
          return sql.create_table(table, the_obj, self.options.core_data_mode).sql;
        } else if (_i === NO_SUCH_COLUMN) {
          return sql.add_column(table, self.errobj.column, null, self.options.core_data_mode).sql;
        } else {
          return null;
        }
      }).call(this);
      sys.debug("compensating sql: " + compensating_sql);
      if ((typeof compensating_sql !== "undefined" && compensating_sql !== null)) {
        db.query(compensating_sql);
        first_one(tx);
      } else if ((typeof callback !== "undefined" && callback !== null)) {
        callback(err);
      }
      return debug("exiting errback");
    };
    insert_into_db = function insert_into_db(tx) {
      var _h, _i, _j, _k, insert;
      _h = []; _i = array_of_inserts;
      for (_j = 0, _k = _i.length; _j < _k; _j++) {
        insert = _i[_j];
        _h.push((function() {
          try {
            return tx.executeSql(insert.escaped);
          } catch (error2) {
            return errback(tx, error2);
          }
        }).call(this));
      }
      return _h;
    };
    // try the first insert first to see if there any errors
    // then the rest
    // this all happens within one sql transaction to make it really fast
    return first_one();
  };
  // closes any underlying SQLite connection
  // currently, this means closes the underlying SQLite db process
  NoSQLite.prototype.close = function close() {
    return this.db.close();
  };
  // Error Handling
  // ------------------------
  NoSQLite.prototype.handle_error = function handle_error(err) {
    var _a;
    this.parse_error(err);
    if ((_a = this.errobj.code) === NO_SUCH_TABLE) {
      return this.create_table();
    }
  };
  NoSQLite.prototype.parse_error = function parse_error(err) {
    this.errobj = {};
    if (err.indexOf("no such table") !== -1) {
      this.errobj.code = NO_SUCH_TABLE;
      return (this.errobj.table = err.split("table: ")[1]);
    } else if (err.indexOf("no column named ") !== -1) {
      this.errobj.code = NO_SUCH_COLUMN;
      return (this.errobj.column = err.split("no column named ")[1].trim());
    } else {
      return (this.errobj.code = UNRECOGNIZED_ERROR);
    }
  };
  // Web API
  // --------------------------------------
  NoSQLite.prototype.write_res = function write_res(response, err, result) {
    if ((typeof err !== "undefined" && err !== null)) {
      response.writeHead(500, {
        "Content-Type": "text/plain"
      });
      response.write(err);
    } else {
      response.writeHead(200, {
        "Content-Type": "text/plain"
      });
      response.write(JSON.stringify(result));
    }
    return response.close();
  };
  // Starts a webserver on the supplied port to serve http requests
  // for the instance's associated database.
  // If NoSQLite has already started a webserver on that port
  // this method returns silently.
  NoSQLite.prototype.listen = function listen(port, host) {
    var http, self, server;
    if (!(typeof host !== "undefined" && host !== null)) {
      host = "127.0.0.1";
    }
    if (!(typeof port !== "undefined" && port !== null)) {
      port = 5000;
    }
    if (!(typeof http !== "undefined" && http !== null)) {
      http = require("http");
    }
    self = this;
    server = http.createServer(function(request, response) {
      var _a, _b, body, table, url;
      body = "";
      url = require("url").parse(request.url, true);
      if (!(typeof (_a = url.query) !== "undefined" && _a !== null) || !(typeof (_b = url.query.method) !== "undefined" && _b !== null)) {
        response.writeHead(500, {
          "Content-Type": "text/plain"
        });
        response.write("Must supply method param");
        response.close();
        return null;
      }
      table = url.query.table;
      // Parse the url to see what the user wants to do
      request.setBodyEncoding('utf8');
      request.addListener("data", function(data) {
        return body += data;
      });
      return request.addListener("end", function() {
        var _c, args, obj, predicate;
        if ((_c = url.query.method) === "save") {
          obj = JSON.parse(body);
          return self.save(table, obj, function(err, result) {
            return self.write_res(response, err, result);
          });
        } else if (_c === "find") {
          predicate = JSON.parse(body);
          return self.find(table, predicate, function(err, result) {
            return self.write_res(response, err, result);
          });
        } else if (_c === "find_or_save") {
          args = JSON.parse(body);
          return self.find_or_save(table, args[0], args[1], function(err, result) {
            return self.write_res(response, err, result);
          });
        } else {
          response.writeHead(500, {
            "Content-Type": "text/plain"
          });
          response.write("Unrecognized method: " + (url.query.method));
          return response.close();
        }
      });
    });
    server.listen(port, host);
    return server;
  };
  NO_SUCH_TABLE = 0;
  NO_SUCH_COLUMN = 1;
  UNRECOGNIZED_ERROR = 99;
  String.prototype.trim = function trim() {
    return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1");
  };
  // connect to NoSQLite this way.
  exports.connect = function connect(db, options) {
    return new NoSQLite(db, options);
  };
  S4 = function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  guid = function guid() {
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
  };
})();
