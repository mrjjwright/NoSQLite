(function(){
  var NO_SUCH_COLUMN, NO_SUCH_TABLE, NoSQLite, UNRECOGNIZED_ERROR, flow, hashlib, sql, sqlite, sys;
  var __hasProp = Object.prototype.hasOwnProperty;
  require("./underscore");
  sql = require("./sql");
  sys = require("sys");
  flow = require("./flow");
  sqlite = require("./sqlite");
  hashlib = require("./hashlib");
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
      safe_mode: true
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
  NoSQLite.prototype.save = function save(table, obj, in_transaction, the_callback) {
    var callback, commit, db, db_head, objects_hash, objs, self, statement, table_head, tx_flag;
    // store special_cols
    if (this.options.safe_mode) {
      objects_hash = this.store_special_cols(obj);
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
    table_head = {
      table_name: table,
      head: undefined
    };
    db_head = {
      table_name: undefined,
      head: undefined
    };
    commit = {};
    return flow.exec(function() {
      // start a transaction if we aren't in one
      tx_flag ? this() : null;
      return db.execute("begin exclusive transaction;", this);
    }, function() {
      // prepare the statement
      return self.prepare_statement(table, objs[0], this);
    }, function(err, statement) {
      var this_flow;
      // iterate through and save each object
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
      tx_flag || !self.options.safe_mode ? this() : null;
      // find the latest head of the db, we will use this for the parent of the commit
      return self.find("nsl_head", {
        "table_name is": undefined
      }, this);
    }, function(err, res) {
      //find the the table head now
      if ((typeof res !== "undefined" && res !== null) && res.length === 1) {
        db_head = res[0];
      }
      tx_flag || !self.options.safe_mode ? this() : null;
      return self.find("nsl_head", {
        table_name: table
      }, this);
    }, function(err, res) {
      // Save a commit object
      tx_flag || !self.options.safe_mode ? this() : null;
      // we ignore errors from the last step since the nsl_head might simply not exist
      if ((typeof res !== "undefined" && res !== null) && res.length === 1) {
        table_head = res[0];
      }
      //create and save the commit object
      // we add a blank commit_id here just so that is the first column in the table
      commit.hash = "";
      commit.table_name = table;
      commit.created_at = new Date().toISOString();
      commit.objects_hash = objects_hash;
      commit.parent = "";
      commit.parent = db_head.head;
      commit.hash = self.hash_object(commit);
      return self.insert_object("nsl_commit", commit, this);
    }, function(err, commit) {
      var this_flow;
      tx_flag || !self.options.safe_mode ? this() : null;
      this_flow = this;
      // update the heads table with db head (table is empty)
      db_head.head = commit.hash;
      table_head.head = commit.hash;
      return self.insert_object("nsl_head", db_head, true, function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        return self.insert_object("nsl_head", table_head, true, this_flow);
      });
    }, function(err, res) {
      tx_flag || !self.options.safe_mode ? this() : null;
      if ((typeof err !== "undefined" && err !== null)) {
        throw err;
      }
      return self.db.execute(("update log set commit_hash='" + (commit.hash) + "' where commit_hash='PENDING'"), this);
    }, function(err, res) {
      // commit the transaction
      tx_flag || !self.options.safe_mode ? this() : null;
      if ((typeof err !== "undefined" && err !== null)) {
        throw err;
      }
      return db.execute("commit;", this);
    }, function() {
      // callback to the user
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, commit);
      }
    });
  };
  // Prepares a statement and returns it
  // If the table doesn't exist, creates it
  NoSQLite.prototype.prepare_statement = function prepare_statement(table, obj, callback) {
    var do_work, insert_sql, self;
    self = this;
    insert_sql = sql.insert(table, obj, false, self.options.core_data_mode).name_placeholder;
    do_work = function do_work() {
      return self.db.prepare(insert_sql, function(err, the_statement) {
        var compensating_sql;
        if ((typeof err !== "undefined" && err !== null)) {
          // This is NoSQLite, let's see if we can fix this!
          compensating_sql = self.compensating_sql(table, obj, err);
          if ((typeof compensating_sql !== "undefined" && compensating_sql !== null)) {
            self.db.execute(compensating_sql, null, function(err) {
              if ((typeof err !== "undefined" && err !== null)) {
                if ((typeof callback !== "undefined" && callback !== null)) {
                  return callback(err);
                }
              } else {
                return do_work();
              }
            });
          } else {
            sys.debug(err);
            if ((typeof callback !== "undefined" && callback !== null)) {
              return callback(err);
            }
          }
        } else {
          callback(null, the_statement);
        }
      });
    };
    return do_work();
  };
  // Inserts an object directly by escaping the values
  // Creates the table if it doesn't exist
  // returns the object
  NoSQLite.prototype.insert_object = function insert_object(table, obj, replace, the_callback) {
    var callback, do_work, insert_sql, replace_flag, self;
    self = this;
    replace_flag = false;
    if (_.isBoolean(replace)) {
      callback = the_callback;
      replace_flag = true;
    } else {
      callback = replace;
    }
    insert_sql = sql.insert(table, obj, replace_flag, self.options.core_data_mode).escaped;
    do_work = function do_work() {
      return self.db.execute(insert_sql, function(err, res) {
        var compensating_sql;
        if ((typeof err !== "undefined" && err !== null)) {
          // This is NoSQLite, let's see if we can fix this!
          compensating_sql = self.compensating_sql(table, obj, err);
          if ((typeof compensating_sql !== "undefined" && compensating_sql !== null)) {
            self.db.execute(compensating_sql, null, function(err) {
              if ((typeof err !== "undefined" && err !== null)) {
                if ((typeof callback !== "undefined" && callback !== null)) {
                  return callback(err);
                }
              } else {
                return do_work();
              }
            });
          } else {
            if ((typeof callback !== "undefined" && callback !== null)) {
              return callback(err);
            }
          }
        } else {
          callback(null, obj);
        }
      });
    };
    return do_work();
  };
  NoSQLite.prototype.compensating_sql = function compensating_sql(table, the_obj, the_err) {
    var _a, _b, compensating_sql, err;
    err = (typeof the_err !== "undefined" && the_err !== null) && (typeof (_b = the_err.message) !== "undefined" && _b !== null) ? the_err.message : the_err;
    this.parse_error(err);
    return compensating_sql = (function() {
      if ((_a = this.errobj.code) === NO_SUCH_TABLE) {
        return sql.create_table(table, the_obj, this.options.core_data_mode).sql;
      } else if (_a === NO_SUCH_COLUMN) {
        return sql.add_column(table, this.errobj.column, null, this.options.core_data_mode).sql;
      } else {
        return null;
      }
    }).call(this);
  };
  // Stores a SHA-1 hash of the object on the objects object_id key
  // object can be an array in which case the SHA_1 will be calculated on
  // each item of the array and a SHA_1 of all the object_ids will
  // be returned
  // the hash is stored on the property, hash name
  NoSQLite.prototype.store_special_cols = function store_special_cols(object) {
    var _a, _b, _c, _d, hash_name, hash_string, obj, obj_arr, sha1;
    hash_name = "hash";
    _.isArray(object) ? (obj_arr = object) : (obj_arr = [object]);
    hash_string = "";
    _b = obj_arr;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      obj = _b[_a];
      // move hash to parent
      obj["commit_hash"] = "PENDING";
      if ((typeof (_d = obj[hash_name]) !== "undefined" && _d !== null) && obj[hash_name] !== "") {
        obj["parent"] = obj[hash_name];
      }
      sha1 = this.hash_object(obj);
      obj[hash_name] = sha1;
      hash_string += sha1;
    }
    return hashlib.sha1(hash_string);
  };
  // Creates a SHA-1 hash of the object's contents
  // in the piped export format of SQLite.
  NoSQLite.prototype.hash_object = function hash_object(object) {
    var _a, i, key, keys_length, value, values;
    values = "";
    i = 0;
    keys_length = Object.keys(object).length - 1;
    _a = object;
    for (key in _a) { if (__hasProp.call(_a, key)) {
      value = _a[key];
      values += value;
      if (i++ < keys_length) {
        values += "|";
      }
    }}
    return hashlib.sha1(values);
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
  NoSQLite.prototype.migrate_table = function migrate_table(table, convert_callback, callback) {
    var _a, _b, self, temp_table_name;
    _a = this;
    self = _a;
    temp_table_name = ("" + (table) + "_backup");
    sys.debug(("Migrating table: " + (table)));
    self.db.execute("begin exclusive transaction", function(_b) {
      var _c;
      _b;
      // 1. create the temp table
      self.find(table, {
        rowid: 1
      }, function(_c) {
        var _d, _e, create_temp_table_sql, err, res, row1;
        _d = arguments;
        err = _d[0];
        res = _d[1];
        row1 = res[0];
        delete row1.rowid;
        create_temp_table_sql = sql.create_temp_table(table, row1);
        self.db.execute(create_temp_table_sql, function(_e) {
          var _f, dump_sql, return_row_id, select_sql;
          _e;
          // 2. dump all rows to the temp table
          return_row_id = false;
          select_sql = ("select * from " + (table));
          dump_sql = ("insert into " + (temp_table_name) + " " + (select_sql) + ";");
          self.db.execute(dump_sql, function(_f) {
            var _g, _h, drop_table_sql;
            _g = arguments;
            err = _g[0];
            res = _g[1];
            if ((typeof err !== "undefined" && err !== null)) {
              return callback(err);
            }
            // 3. drop and recreate the table
            drop_table_sql = ("drop table " + (table));
            self.db.execute(drop_table_sql, function(_h) {
              var _i, _j, create_table_sql, obj1;
              _i = arguments;
              err = _i[0];
              res = _i[1];
              if ((typeof err !== "undefined" && err !== null)) {
                return callback(err);
              }
              // we use the first object to convert
              // so we get the new schema correct
              obj1 = convert_callback(row1);
              create_table_sql = sql.create_table(table, obj1).sql;
              self.db.execute(create_table_sql, function(_j) {
                var _k;
                err = _j;
                if ((typeof err !== "undefined" && err !== null)) {
                  return callback(err);
                }
                // commit and close the transaction
                self.db.execute("commit", function(_k) {
                  var _l;
                  _k;
                  // 4. Prepare statements to
                  // convert the rest of the rows and save to new table
                  self.db.prepare(("select * from " + (temp_table_name) + " where rowid >= 1"), function(_l) {
                    var _m, _n, db1, statement;
                    _m = arguments;
                    err = _m[0];
                    statement = _m[1];
                    if ((typeof err !== "undefined" && err !== null)) {
                      return callback(err);
                    }
                    // open up another connection to the db
                    db1 = new sqlite.Database();
                    db1.open(self.db_file, function(_n) {
                      var _o;
                      _n;
                      db1.execute("begin exclusive transaction");
                      db1.prepare(sql.insert(table, obj1).name_placeholder, function(_o) {
                        var _p, cleanup_and_callback, migrate_rows, statement1;
                        _p = arguments;
                        err = _p[0];
                        statement1 = _p[1];
                        if ((typeof err !== "undefined" && err !== null)) {
                          return callback(err);
                        }
                        // 5. Step through each row of the temp table
                        // , call the convert_callback
                        // , and then in another sqlite connection insert the row
                        // into the new table.
                        //  This way all rows are not read into memory
                        migrate_rows = function migrate_rows() {
                          var _q;
                          statement.step(function(_q) {
                            var _r, _s, converted_obj, row;
                            _r = arguments;
                            err = _r[0];
                            row = _r[1];
                            if (!(typeof row !== "undefined" && row !== null)) {
                              return cleanup_and_callback();
                            }
                            try {
                              converted_obj = convert_callback(row);
                            } catch (error) {
                              return callback(err);
                            }
                            statement1.reset();
                            self.bind_obj(statement1, converted_obj);
                            // step once to do the insert
                            statement1.step(function(_s) {
                              err = _s;
                              if ((typeof err !== "undefined" && err !== null)) {
                                return callback(err);
                              }
                              return migrate_rows();
                              return undefined;
                            });
                          });
                        };
                        migrate_rows();
                        cleanup_and_callback = function cleanup_and_callback() {
                          var _q;
                          // 6.clean up
                          db1.execute("commit", function(_q) {
                            var _r;
                            _q;
                            statement.finalize(function(_r) {
                              var _s;
                              _r;
                              statement1.finalize(function(_s) {
                                var _t;
                                _s;
                                db1.close(function(_t) {
                                  var _u;
                                  _t;
                                  // 7. drop the temp table and alert the callback
                                  self.db.execute(("drop table " + (temp_table_name)), function(_u) {
                                    var _v;
                                    _v = arguments;
                                    err = _v[0];
                                    res = _v[1];
                                    if ((typeof err !== "undefined" && err !== null)) {
                                      return callback(err);
                                    }
                                    if ((typeof callback !== "undefined" && callback !== null)) {
                                      return callback(null, "success");
                                    }
                                    return undefined;
                                  });
                                });
                              });
                            });
                          });
                        };
                        return cleanup_and_callback;
                        return undefined;
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  // Syncing code
  // This group is devoted to plumbing functions that sync 2 tables, I mean refs, I means dbs
  // It works for all 3.  It's magic.
  // fetches all the objects after a certain commit hash
  NoSQLite.prototype.objects_since_commit = function objects_since_commit(commit_hash, callback) {
    var self;
    self = this;
    return self.db.execute("select * from log where commit_hash in (select hash from nsl_commit where rowid > (select rowid from nsl_commit where hash = :head))", [commit_hash], function(err, res) {
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      return callback(null, res);
      //
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
