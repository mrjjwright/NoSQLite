(function(){
  var NO_SUCH_COLUMN, NO_SUCH_TABLE, UNRECOGNIZED_ERROR, bind_obj, compensating_sql, execute_statement, find, find_or_save, hash_object, insert_object, migrate_table, nosqlite, parse_error, prepare_statement, save;
  var __hasProp = Object.prototype.hasOwnProperty;
  // Functions soley about getting stuff into and out of the database
  NO_SUCH_TABLE = 0;
  NO_SUCH_COLUMN = 1;
  UNRECOGNIZED_ERROR = 99;
  // Error Handling
  // ------------------------
  compensating_sql = function compensating_sql(table, the_obj, the_err) {
    var _a, _b, compensating_sql, err, errobj;
    err = (typeof the_err !== "undefined" && the_err !== null) && (typeof (_a = the_err.message) !== "undefined" && _a !== null) ? the_err.message : the_err;
    errobj = parse_error(err);
    compensating_sql = (function() {
      if ((_b = errobj.code) === NO_SUCH_TABLE) {
        return sql.create_table(table, the_obj).sql;
      } else if (_b === NO_SUCH_COLUMN) {
        return sql.add_column(table, errobj.column, null).sql;
      } else {
        return null;
      }
    })();
    return compensating_sql;
  };
  parse_error = function parse_error(err) {
    var errobj;
    errobj = {};
    if (err.indexOf("no such table") !== -1) {
      errobj.code = NO_SUCH_TABLE;
      errobj.table = err.split("table: ")[1];
    } else if (err.indexOf("no column named ") !== -1) {
      errobj.code = NO_SUCH_COLUMN;
      errobj.column = err.split("no column named ")[1].trim();
    } else {
      errobj.code = UNRECOGNIZED_ERROR;
    }
    return errobj;
  };
  // Creates a SHA-1 hash of the object's contents
  // in the piped export format of SQLite.
  hash_object = function hash_object(object) {
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
  // Finds an object or objects in the SQLite by running a query
  // derived from the supplied predicate on the supplied table.
  //
  // Predicate syntax
  // --------------------------
  // The following is the supported predicate syntax:
  //
  // As always, we will call you back when everything is ready!
  find = function find(table, predicate, the_callback) {
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
  find_or_save = function find_or_save(table, predicate, obj, callback) {
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
  save = function save(table, obj, in_transaction, the_callback) {
    var callback, commit, db, db_head, nsl_obj_statement, nsl_parent_statement, objs, self, table_head, tx_flag, user_statement;
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
    user_statement = {};
    nsl_obj_statement = {};
    nsl_parent_statement = {};
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
      // tell flow to skip to end on any errors so we can handle them in one place
      this.skipToEndOnError = true;
      // start a transaction if we aren't in one
      if (tx_flag) {
        return this();
      }
      return db.execute("begin exclusive transaction;", this);
    }, function() {
      // prepare the statements
      // first prepare the user table statement
      return self.prepare_statement(table, objs[0], this);
    }, function(err, statement) {
      var this_flow, user_obj_statement;
      user_obj_statement = statement;
      // iterate through and save each object
      this_flow = this;
      return flow.serialForEach(objs, function(the_obj) {
        var this_serial;
        this_serial = this;
        // insert the users_object
        return self.execute_statement(user_statement, the_obj, function() {
          return self.insert_nsl_obj(nsl_obj_statement, function() {
            return self.insert_plink(plink_statement, the_obj, this_serial);
          });
        });
      }, function(error, res) {
        if ((typeof error !== "undefined" && error !== null)) {
          return callback(err);
        }
      }, this_flow);
    }, function() {
      if (tx_flag || !self.options.safe_mode) {
        return this();
      }
      // find the latest head of the db, we will use this for the parent of the commit
      return self.find("nsl_head", {
        "table_name is": undefined
      }, this);
    }, function(err, res) {
      //find the the table head now
      if ((typeof res !== "undefined" && res !== null) && res.length === 1) {
        db_head = res[0];
      }
      if (tx_flag || !self.options.safe_mode) {
        return this();
      }
      return self.find("nsl_head", {
        table_name: table
      }, this);
    }, function(err, res) {
      var _a;
      // Save a commit object
      if (tx_flag || !self.options.safe_mode) {
        return this();
      }
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
      if ((typeof (_a = db_head.head) !== "undefined" && _a !== null)) {
        commit.parent = db_head.head;
      }
      commit.hash = hash_object(commit);
      return self.insert_object("nsl_commit", commit, this);
    }, function(err, commit) {
      var this_flow;
      if (tx_flag || !self.options.safe_mode) {
        return this();
      }
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
      if (tx_flag || !self.options.safe_mode) {
        return this();
      }
      if ((typeof err !== "undefined" && err !== null)) {
        throw err;
      }
      return self.db.execute(("update log set commit_hash='" + (commit.hash) + "' where commit_hash='PENDING'"), this);
    }, function(err, res) {
      // commit the transaction
      if (tx_flag || !self.options.safe_mode) {
        return this();
      }
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
  // The first arg can be any sql to prepare or the table name
  // The second arg can the obj to insert or the callback
  // If the table doesn't exist, creates it
  prepare_statement = function prepare_statement(table, obj, the_callback) {
    var _a, callback, do_work, insert_sql, self;
    self = this;
    callback = the_callback;
    if ((typeof (_a = _.isFunction(obj)) !== "undefined" && _a !== null)) {
      callback = obj;
      insert_sql = table;
    } else {
      insert_sql = sql.insert(table, obj, false, self.options.core_data_mode).name_placeholder;
    }
    do_work = function do_work() {
      return self.db.prepare(insert_sql, function(err, the_statement) {
        var comp_sql;
        if ((typeof err !== "undefined" && err !== null)) {
          // This is NoSQLite, let's see if we can fix this!
          comp_sql = compensating_sql(table, obj, err);
          if ((typeof comp_sql !== "undefined" && comp_sql !== null)) {
            self.db.execute(comp_sql, null, function(err) {
              if ((typeof err !== "undefined" && err !== null)) {
                if ((typeof callback !== "undefined" && callback !== null)) {
                  return callback(err);
                }
              } else {
                return do_work();
              }
            });
          } else {
            nsl_debug(err);
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
  // Executes a prepared statement against an object or objects
  // obj can be an array of objects
  // Of course each object should have properties that
  // match each named parameter in the prepared statement
  execute_statement = function execute_statement(statement, obj, callback) {
    var objs, self;
    self = this;
    if (_.isArray(obj)) {
      objs = obj;
    }
    if (!_.isArray(obj)) {
      objs = [obj];
    }
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
    }, callback);
  };
  // Inserts an object directly by escaping the values
  // Creates the table if it doesn't exist
  // returns the object
  insert_object = function insert_object(table, obj, replace, the_callback) {
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
        var comp_sql;
        if ((typeof err !== "undefined" && err !== null)) {
          // This is NoSQLite, let's see if we can fix this!
          comp_sql = compensating_sql(table, obj, err);
          if ((typeof comp_sql !== "undefined" && comp_sql !== null)) {
            self.db.execute(comp_sql, null, function(err) {
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
  // binds all the keys in an object to a statement
  // by name
  bind_obj = function bind_obj(statement, obj) {
    var _a, _b, i, key, num_of_keys, value;
    num_of_keys = Object.keys(obj).length;
    i = 0;
    _a = []; _b = obj;
    for (key in _b) { if (__hasProp.call(_b, key)) {
      _a.push((function() {
        value = obj[key];
        if (!_.isString(value) && !_.isNumber(value)) {
          value = JSON.stringify(value);
          //nsl_debug "Binding ${value} to :${key} "
        }
        return statement.bind((":" + (key)), value);
      })());
    }}
    return _a;
  };
  migrate_table = function migrate_table(table, convert_callback, callback) {
    var _a, _b, _c, _d, _e, cleanup_and_callback, create_table_sql, create_temp_table_sql, db1, drop_table_sql, dump_sql, err, migrate_rows, obj1, res, return_row_id, row1, select_sql, self, statement, statement1, temp_table_name;
    self = this;
    temp_table_name = ("" + (table) + "_backup");
    nsl_debug(("Migrating table: " + (table)));
    defer(self.db.execute("begin exclusive transaction"));
    // 1. create the temp table
    _a = defer(self.find(table, {
      rowid: 1
    }));
    err = _a[0];
    res = _a[1];
    row1 = res[0];
    delete row1.rowid;
    create_temp_table_sql = sql.create_temp_table(table, row1);
    defer(self.db.execute(create_temp_table_sql));
    // 2. dump all rows to the temp table
    return_row_id = false;
    select_sql = ("select * from " + (table));
    dump_sql = ("insert into " + (temp_table_name) + " " + (select_sql) + ";");
    _b = defer(self.db.execute(dump_sql));
    err = _b[0];
    res = _b[1];
    if ((typeof err !== "undefined" && err !== null)) {
      return callback(err);
    }
    // 3. drop and recreate the table
    drop_table_sql = ("drop table " + (table));
    _c = defer(self.db.execute(drop_table_sql));
    err = _c[0];
    res = _c[1];
    if ((typeof err !== "undefined" && err !== null)) {
      return callback(err);
    }
    // we use the first object to convert
    // so we get the new schema correct
    obj1 = convert_callback(row1);
    create_table_sql = sql.create_table(table, obj1).sql;
    err = defer(self.db.execute(create_table_sql));
    if ((typeof err !== "undefined" && err !== null)) {
      return callback(err);
    }
    // commit and close the transaction
    defer(self.db.execute("commit"));
    // 4. Prepare statements to
    // convert the rest of the rows and save to new table
    _d = defer(self.db.prepare(("select * from " + (temp_table_name) + " where rowid >= 1")));
    err = _d[0];
    statement = _d[1];
    if ((typeof err !== "undefined" && err !== null)) {
      return callback(err);
    }
    // open up another connection to the db
    db1 = new sqlite.Database();
    defer(db1.open(self.db_file));
    db1.execute("begin exclusive transaction");
    _e = defer(db1.prepare(sql.insert(table, obj1).name_placeholder));
    err = _e[0];
    statement1 = _e[1];
    if ((typeof err !== "undefined" && err !== null)) {
      return callback(err);
    }
    // 5. Step through each row of the temp table
    // , call the convert_callback
    // , and then in another sqlite connection insert the row
    // into the new table.
    //  This way all rows are not read into memory
    migrate_rows = function migrate_rows() {
      var _f, converted_obj, row;
      _f = defer(statement.step());
      err = _f[0];
      row = _f[1];
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
      err = defer(statement1.step());
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      return migrate_rows();
    };
    migrate_rows();
    cleanup_and_callback = function cleanup_and_callback() {
      var _f;
      // 6.clean up
      defer(db1.execute("commit"));
      defer(statement.finalize());
      defer(statement1.finalize());
      defer(db1.close());
      // 7. drop the temp table and alert the callback
      _f = defer(self.db.execute(("drop table " + (temp_table_name))));
      err = _f[0];
      res = _f[1];
      if ((typeof err !== "undefined" && err !== null)) {
        return callback(err);
      }
      if ((typeof callback !== "undefined" && callback !== null)) {
        return callback(null, "success");
      }
    };
    return cleanup_and_callback;
  };
  nosqlite = !(typeof exports !== "undefined" && exports !== null) && (typeof window !== "undefined" && window !== null) ? window.NoSQLite : require("./nosqlite").NoSQLite;
  nosqlite.prototype.find_or_save = find_or_save;
  nosqlite.prototype.save = save;
  nosqlite.prototype.insert_object = insert_object;
  nosqlite.prototype.migrate_table = migrate_table;
})();
