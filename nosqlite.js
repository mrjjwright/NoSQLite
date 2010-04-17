(function(){
  var NO_SUCH_COLUMN, NO_SUCH_TABLE, NoSQLite, UNRECOGNIZED_ERROR, flow, sql, sqlite, sys;
  var __hasProp = Object.prototype.hasOwnProperty;
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
  NoSQLite = function NoSQLite(db_file, options, the_callback) {
    var callback;
    sys.debug("creating instance of NoSQLite");
    this.db_file = db_file;
    this.db = new sqlite.Database();
    this.table_descriptions = [];
    this.options = {
      core_data_mode: false,
      no_guid: false
    };
    if (_.isFunction(options)) {
      callback = options;
    } else {
      if ((typeof options !== "undefined" && options !== null)) {
        this.options = _.extend(this.options, options);
      }
      callback = the_callback;
    }
    //until we can get a truly async interface to sqlite
    //process.nextTick ->
    //callback(null, this)
    this.db.open(db_file, function(err) {
      return callback(err);
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
  NoSQLite.prototype.find = function find(table, predicate, the_callback) {
    var callback, db, select, self;
    select = sql.select(table, predicate);
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
      if ((typeof the_rest !== "undefined" && the_rest !== null)) {
        return _.each(the_rest, function(the_obj) {
          the_predicate = sql.populate_predicate(predicate, the_obj);
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
  // You can pass in an array of objects as well.	Each row will be inserted
  // As always, we'll call you back when everything is ready!
  NoSQLite.prototype.save = function save(table, obj, in_transaction, the_callback) {
    var _a, _b, _c, _d, callback, db, o, objs, self, statement, tx_flag;
    //augment object with guid unless options say not to
    if (this.options.no_guid === false) {
      if (!_.isArray(obj)) {
        !(typeof (_a = obj.guid) !== "undefined" && _a !== null) ? (obj.guid = Math.uuidFast()) : null;
      } else {
        _c = obj;
        for (_b = 0, _d = _c.length; _b < _d; _b++) {
          o = _c[_b];
          !o.guid ? (o.guid = Math.uuidFast()) : null;
        }
      }
    }
    tx_flag = false;
    callback = in_transaction;
    if (_.isBoolean(in_transaction)) {
      tx_flag = in_transaction;
      callback = the_callback;
    }
    if (_.isArray(obj)) {
      objs = obj;
    }
    if (!_.isArray(obj)) {
      objs = [obj];
    }
    self = this;
    db = this.db;
    statement = {};
    return flow.exec(function() {
      // start a transaction if we aren't in one
      if (!tx_flag) {
        return db.execute("begin transaction;", this);
      } else {
        return this();
      }
    }, function() {
      var prepare_statement, this_flow;
      // save the first one
      this_flow = this;
      prepare_statement = function prepare_statement() {
        var insert_sql;
        insert_sql = sql.insert(table, objs[0], self.options.core_data_mode).name_placeholder;
        //sys.debug insert_sql
        return db.prepare(insert_sql, function(err, the_statement) {
          var compensating_sql;
          if ((typeof err !== "undefined" && err !== null)) {
            // This is NoSQLite, let's see if we can fix this!
            compensating_sql = self.compensating_sql(table, objs[0], err);
            if ((typeof compensating_sql !== "undefined" && compensating_sql !== null)) {
              return db.execute(compensating_sql, null, function(err) {
                if ((typeof err !== "undefined" && err !== null)) {
                  if ((typeof callback !== "undefined" && callback !== null)) {
                    return callback(err);
                  }
                } else {
                  return prepare_statement();
                }
              });
            } else if ((typeof callback !== "undefined" && callback !== null)) {
              return callback(err);
            }
          } else {
            statement = the_statement;
            return this_flow(statement);
          }
        });
      };
      return prepare_statement();
    }, function() {
      var this_flow;
      // save the rest
      this_flow = this;
      return flow.serialForEach(objs, function(the_obj) {
        var this_serial;
        this_serial = this;
        statement.reset();
        self.bind_obj(statement, the_obj);
        return statement.step(function() {
          return this_serial();
        });
      }, function(error, res) {
        if ((typeof error !== "undefined" && error !== null)) {
          throw error;
        }
      }, this_flow);
    }, function() {
      // commit the transaction
      if (!tx_flag) {
        return db.execute("commit;", this);
      } else {
        return this();
      }
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
    compensating_sql = (function() {
      if ((_b = this.errobj.code) === NO_SUCH_TABLE) {
        return sql.create_table(table, the_obj, this.options.core_data_mode).sql;
      } else if (_b === NO_SUCH_COLUMN) {
        return sql.add_column(table, this.errobj.column, null, this.options.core_data_mode).sql;
      } else {
        return null;
      }
    }).call(this);
    return compensating_sql;
  };
  // binds all the keys in an object to a statement
  // by name
  NoSQLite.prototype.bind_obj = function bind_obj(statement, obj) {
    var _a, _b, i, key, num_of_keys, value;
    num_of_keys = Object.keys(obj).length;
    i = 0;
    _a = []; _b = obj;
    for (key in _b) { if (__hasProp.call(_b, key)) {
      _a.push((function() {
        value = obj[key];
        if (!_.isString(value) && !_.isNumber(value)) {
          value = JSON.stringify(value);
          //sys.debug "Binding ${value} to :${key} "
        }
        return statement.bind((":" + (key)), value);
      })());
    }}
    return _a;
  };
  // closes the underlying SQLite connection
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
      this.errobj.table = err.split("table: ")[1];
      return this.errobj.table;
    } else if (err.indexOf("no column named ") !== -1) {
      this.errobj.code = NO_SUCH_COLUMN;
      this.errobj.column = err.split("no column named ")[1].trim();
      return this.errobj.column;
    } else {
      this.errobj.code = UNRECOGNIZED_ERROR;
      return this.errobj.code;
    }
  };
  // Migrations
  // -------------------------------------
  // A handy utility for doing a SQLite table data or schema migration.
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
  // for every other row in the temp table.  You can do data conversions in this callback
  //
  // Finally, the temp table is deleted and the callback(err, res) function is called.
  // If any errors occur, callback(err) will be called.
  // (Based roughly on the approach detailed in http://www.sqlite.org/faq.html, question 11)
  NoSQLite.prototype.migrate_table = function migrate_table(table, convert_callback, callback) {
    var db1, obj1, row1, self, statement, statement1, temp_table_name;
    self = this;
    row1 = {};
    obj1 = {};
    statement = {};
    statement1 = {};
    db1 = {};
    temp_table_name = ("" + (table) + "_backup");
    sys.debug(("Migrating table: " + (table)));
    return flow.exec(function() {
      return self.db.execute("begin transaction", this);
    }, function() {
      var this_flow;
      // create the temp table
      this_flow = this;
      return self.find(table, {
        rowid: 1
      }, function(err, res) {
        var create_temp_table_sql;
        row1 = res[0];
        delete row1.rowid;
        create_temp_table_sql = sql.create_temp_table(table, row1);
        return self.db.execute(create_temp_table_sql, this_flow);
      });
    }, function() {
      var dump_sql, return_row_id, select_sql, this_flow;
      // dump all rows to the temp table
      this_flow = this;
      return_row_id = false;
      select_sql = ("select * from " + (table));
      dump_sql = ("insert into " + (temp_table_name) + " " + (select_sql) + ";");
      return self.db.execute(dump_sql, function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
        return this_flow();
      });
    }, function() {
      var drop_table_sql, this_flow;
      //drop and recreate the table
      this_flow = this;
      drop_table_sql = ("drop table " + (table));
      return self.db.execute(drop_table_sql, function(err, res) {
        var create_table_sql;
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
        // we start with the first object to convert
        // so we get the new schema correct
        obj1 = convert_callback(row1);
        create_table_sql = sql.create_table(table, obj1).sql;
        return self.db.execute(create_table_sql, function(err) {
          (typeof err !== "undefined" && err !== null) ? callback(err) : null;
          return this_flow();
        });
      });
    }, function() {
      // commit and close the transaction
      return self.db.execute("commit", this);
    }, function() {
      var this_flow;
      // Prepare statements to
      // Convert the rest of the rows and save to new table
      this_flow = this;
      return self.db.prepare(("select * from " + (temp_table_name) + " where rowid > 1"), function(err, the_statement) {
        if (((typeof err !== "undefined" && err !== null))) {
          return callback(err);
        }
        statement = the_statement;
        // open up another connection to the db
        db1 = new sqlite.Database();
        return db1.open(self.db_file, function() {
          db1.execute("begin transaction");
          return db1.prepare(sql.insert(table, obj1).name_placeholder, function(err, the_statement) {
            if (((typeof err !== "undefined" && err !== null))) {
              return callback(err);
            }
            statement1 = the_statement;
            return this_flow();
          });
        });
      });
    }, function() {
      var migrate_row, this_flow;
      // Step through each row of the temp table
      // , call the convert_callback
      // , and then in another sqlite connection insert the row
      // into the new table.
      //  This way all rows are not read into memory
      this_flow = this;
      migrate_row = function migrate_row() {
        return statement.step(function(err, row) {
          var converted_obj;
          if (!(typeof row !== "undefined" && row !== null)) {
            return this_flow();
          }
          converted_obj = convert_callback(row);
          statement1.reset();
          self.bind_obj(statement1, converted_obj);
          // step once to do the insert
          return statement1.step(function(err) {
            if ((typeof err !== "undefined" && err !== null)) {
              return callback(err);
            }
            return migrate_row();
          });
        });
      };
      return migrate_row();
    }, function() {
      // clean up
      return db1.execute("commit", function() {
        return statement.finalize(function() {
          return statement1.finalize(function() {
            return db1.close(function() {
              return this;
            });
          });
        });
      });
    }, function() {
      // drop the temp table and alert the callback
      return self.db.execute(("drop table " + (temp_table_name)), function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          return callback(err);
        }
        if ((typeof callback !== "undefined" && callback !== null)) {
          return callback(null, "success");
        }
      });
    });
  };
  // Web API
  // --------------------------------------
  NoSQLite.prototype.write_res = function write_res(response, err, result) {
    if ((typeof err !== "undefined" && err !== null)) {
      response.writeHead(500, {
        "Content-Type": "text/plain"
      });
      response.write(err.message);
    } else {
      response.writeHead(200, {
        "Content-Type": "text/plain"
      });
      response.write(JSON.stringify(result));
    }
    return response.end();
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
        response.end();
        return null;
      }
      table = url.query.table;
      // Parse the url to see what the user wants to do
      request.setBodyEncoding('utf8');
      request.addListener("data", function(data) {
        return body += data;
      });
      return request.addListener("end", function() {
        var _c, _d, args, obj, predicate, records_to_save;
        if ((_c = url.query.method) === "save") {
          obj = JSON.parse(body);
          return self.save(table, obj, function(err, result) {
            return self.write_res(response, err, result);
          });
        } else if (_c === "find") {
          predicate = JSON.parse(body);
          if ((typeof (_d = predicate.records) !== "undefined" && _d !== null)) {
            // The client is sending some records to save along with asking for new records
            // This is for convenience for clients that want to do a simple sync in one http call
            records_to_save = predicate.records;
            predicate = predicate.predicate;
            return self.save(table, records_to_save, function(err, result) {
              if ((typeof err !== "undefined" && err !== null)) {
                return self.write_res(response, err);
              }
              return self.find(table, predicate, function(err, result) {
                return self.write_res(response, err, result);
              });
            });
          } else {
            return self.find(table, predicate, function(err, result) {
              return self.write_res(response, err, result);
            });
          }
        } else if (_c === "find_or_save") {
          args = JSON.parse(body);
          return self.find_or_save(table, args[0], args[1], function(err, result) {
            return self.write_res(response, err, result);
          });
        } else {
          response.writeHead(500, {
            "Content-Type": "text/plain"
          });
          response.write(("Unrecognized method: " + (url.query.method)));
          return response.end();
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
