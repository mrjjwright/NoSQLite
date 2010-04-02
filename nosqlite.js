(function(){
  var NO_SUCH_COLUMN, NO_SUCH_TABLE, NoSQLite, UNRECOGNIZED_ERROR, flow, sql, sqlite, sys;
  require("./underscore");
  sql = require("./sql");
  require("./Math.uuid");
  sys = require("sys");
  flow = require("./flow");
  sqlite = require("./sqlite");
  // NoSQLite - SQLite for Javascript
  // ---------------------------------
  //
  // A library to make it as easy as possible to store and retrieve JS objects
  // from SQLite. Zero-configuration!
  // Attempts to store JS objects as intelligently as possible in SQLite.
  NoSQLite = function NoSQLite(db_file, options, callback) {
    var the_callback;
    sys.debug("creating instance of NoSQLite");
    this.db = new sqlite.Database();
    this.table_descriptions = [];
    this.options = {
      core_data_mode: false,
      no_guid: false
    };
    if (_.isFunction(options)) {
      the_callback = options;
    } else {
      if ((typeof options !== "undefined" && options !== null)) {
        this.options = _.extend(this.options, options);
      }
      the_callback = callback;
      //go ahead and open the db
    }
    this.db.open(db_file, function() {
      return the_callback();
    });
    return this;
  };
  // Pass in a path to a sqlite file
  // Pass in an optional Core Data compatible mode flag.
  // params:
  // * path to db.
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
      return db.query(select.escaped, function(res) {
        return callback(null, res);
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
  // Stores an object or objects in SQLite.
  // If the table doesn't exist, NoSQLite will create the table for you.
  // If the objects already exist in the database NoSQL they will be updated because
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
  // You can pass in an array of objects as well.  Each row will be inserted
  // As always, we'll call you back when everything is ready!
  NoSQLite.prototype.save = function save(table, obj, in_transaction, the_callback) {
    var _a, _b, _c, _d, _e, _f, _g, callback, db, inserts, o, self, table_obj, the_obj, tx_flag;
    //augment object with guid unless options say not to
    if (this.options.no_guid === false) {
      if (!_.isArray(obj)) {
        obj.guid = Math.uuidFast();
      } else {
        _a = obj;
        for (_b = 0, _c = _a.length; _b < _c; _b++) {
          o = _a[_b];
          o.guid = Math.uuidFast();
        }
      }
    }
    tx_flag = false;
    callback = in_transaction;
    if (_.isBoolean(in_transaction)) {
      tx_flag = in_transaction;
      callback = the_callback;
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
    return flow.exec(function() {
      // start a transaction if we aren't in one
      return !tx_flag ? db.query("begin transaction", this) : this();
    }, function() {
      var self_this, try_first_one;
      // save the first one
      self_this = this;
      try_first_one = function try_first_one() {
        return db.query(inserts[0].escaped, null, function(err) {
          var compensating_sql;
          if ((typeof err !== "undefined" && err !== null)) {
            // This is NoSQLite, let's see if we can fix this!
            compensating_sql = self.compensating_sql(table, the_obj, err);
            if ((typeof compensating_sql !== "undefined" && compensating_sql !== null)) {
              return db.query(compensating_sql, null, function(err) {
                if ((typeof err !== "undefined" && err !== null)) {
                  if ((typeof callback !== "undefined" && callback !== null)) {
                    return callback(err);
                  }
                } else {
                  return try_first_one();
                }
              });
            } else if ((typeof callback !== "undefined" && callback !== null)) {
              return callback(err);
            }
          } else {
            return self_this();
          }
        });
      };
      return try_first_one();
    }, function() {
      var do_insert, self_this;
      // save the rest
      self_this = this;
      do_insert = function do_insert(i) {
        return db.query(inserts[i].escaped, function(err) {
          if ((typeof err !== "undefined" && err !== null)) {
            callback(err);
            return null;
          }
          return i-- ? do_insert(i) : self_this();
        });
      };
      return inserts.length > 1 ? do_insert(inserts.length - 1) : this();
    }, function() {
      // commit the transaction
      return !tx_flag ? db.query("commit", this) : this();
    }, function() {
      // callback to the user
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, "success");
      }
    });
  };
  NoSQLite.prototype.compensating_sql = function compensating_sql(table, the_obj, the_err) {
    var _a, _b, compensating_sql, err;
    err = (typeof the_err !== "undefined" && the_err !== null) && (typeof (_a = the_err.message) !== "undefined" && _a !== null) ? the_err.message : the_err;
    this.parse_error(err);
    return (compensating_sql = (function() {
      if ((_b = this.errobj.code) === NO_SUCH_TABLE) {
        return sql.create_table(table, the_obj, this.options.core_data_mode).sql;
      } else if (_b === NO_SUCH_COLUMN) {
        return sql.add_column(table, this.errobj.column, null, this.options.core_data_mode).sql;
      } else {
        return null;
      }
    }).call(this));
  };
  // closes any underlying SQLite connection
  // currently, this means closes the underlying SQLite db process
  NoSQLite.prototype.close = function close() {
    return this.db.close(function() {    });
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
  // Migrations
  // -------------------------------------
  // A handy utility for doing a SQLite table schema migration.
  //
  // If something goes wrong here at the wrong time,
  // not that it will, I know you have a backup. :)
  //
  // First creates a temporary table and dumps all the rows from the old table.
  // The old table is then dropped.
  //
  // The convert_callback(old_obj) will then be called for the first row in
  // in the temp table.  The object returned by convert_callback
  // should implicitly describe (using nosqlite conventions, detailed in docs for save)
  // the new schema that will be used to create the new table.
  // The first row will be inserted and convert_callback will be called for
  // for every other row in the temp table.
  //
  // Finally, the temp table is deleted and the callback(err, res) function is called.
  // If any errors occur, callback(err) will be called.
  // (Based roughly on the approach detailed in http://www.sqlite.org/faq.html, question 11)
  NoSQLite.prototype.migrate_table = function migrate_table(table, convert_callback, callback) {
    var create_temp_table, row1, self;
    self = this;
    row1 = {};
    flow.exec(function() {
      //create the temp table
      return self.find(table, {
        rowid: 1
      }, function(err, res) {
        row1 = res[0];
        return create_temp_table(row1, this);
      });
    }, function() {
      var new_obj, this_flow;
      this_flow = this;
      //convert and save the first row
      new_obj = convert_callback(row1);
      return self.save(table, new_obj, function(err, res) {
        (typeof err !== "undefined" && err !== null) ? callback(err) : null;
        return this_flow();
      });
    }, function() {
      this_flow();
      //convert the rest of the rows
      return self.find(table, {
        'rowid >': 1
      }, function(err, res) {
        var _a, _b, _c, _d, converted_obj, row;
        _a = []; _b = res;
        for (_c = 0, _d = _b.length; _c < _d; _c++) {
          row = _b[_c];
          _a.push((function() {
            converted_obj = convert_callback(row);
            return self.save(table, converted_obj, function(err, res) {
              (typeof err !== "undefined" && err !== null) ? callback(err) : null;
              return this_flow();
            });
          }).call(this));
        }
        return _a;
      });
    }, function() {
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, "success");
      }
    });
    // create the temp table.
    // We create it with the same number of cols as the old table
    // We don't care about the types
    return create_temp_table = function create_temp_table(obj, callback) {
      var temp_cols, temp_table_sql;
      // execute a pragma to get the number of cols in the old table
      temp_cols = obj.keys.join(",");
      temp_table_sql = "create temporary table " + (table) + "_backup(" + (temp_cols) + ");";
      // this doesn't execute async (yet)
      db.query(temp_table_sql);
      return callback();
    };
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
            return (typeof result !== "undefined" && result !== null) ? self.write_res(response, err, result) : null;
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
  exports.connect = function connect(db, options, callback) {
    return new NoSQLite(db, options, callback);
  };
})();
