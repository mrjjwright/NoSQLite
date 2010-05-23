(function(){
  var assert, fs, nosqlite, peer1, peer2, remove_file, sys, test_add_remote, test_fetch_commits, test_find, test_find_or_save, test_migration, test_objects_since_commit, test_pull, test_pull_again, test_save, test_save_bulk, test_save_cd, test_save_multiple, test_save_web, test_update_object;
  sys = require("sys");
  nosqlite = require("../lib/nosqlite").nosqlite;
  fs = require("fs");
  assert = require("assert");
  remove_file = function(file) {
    try {
      return fs.unlinkSync(file);
    } catch (err) {
      return sys.puts(err);
    }
  };
  test_find = function() {
    var db, db_file, save_sync_hook;
    db_file = "./test/test_find.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      var log;
      log = {
        text: "hello",
        occurred_at: new Date().getTime(),
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
        source: "string1",
        log_type: "string1",
        geo_lat: "string1",
        geo_long: "string1",
        metric: 5,
        external_id: 10,
        level: 5,
        readable_metric: "5 miles",
        facts: ["hello", "hello", "hello1"],
        original: {
          id: 1,
          text: "some crazy object"
        }
      };
      return db.save({
        table: "log",
        obj: log
      }, save_sync_hook, function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        return db.find("log", {
          text: "hello"
        }, function(err, result) {
          if ((typeof err !== "undefined" && err !== null)) {
            throw err;
          }
          assert.equal(result[0].text, "hello", "should find single object");
          assert.equal(result[0].facts[2], "hello1", "should recreate arrays");
          assert.equal(result[0].original.id, 1, "should recreate complex Objects");
          return db.find("nsl_obj", {
            tbl_name: "log"
          }, function(err, res) {
            if ((typeof err !== "undefined" && err !== null)) {
              throw err;
            }
            assert.equal(res[0].tbl_name, "log", "should find aux obj");
            return sys.debug("Test simple save and find: passed");
          });
        });
      });
    });
    save_sync_hook = function(rowid, obj_desc) {
      var nsl_obj;
      nsl_obj = {
        oid: rowid,
        tbl_name: obj_desc.table
      };
      return [
        {
          table: "nsl_obj",
          obj: nsl_obj
        }, {
          table: "unclustered",
          obj: {
            oid: rowid
          }
        }, {
          table: "unsent",
          obj: {
            oid: rowid
          }
        }
      ];
    };
    return save_sync_hook;
  };
  test_save_cd = function() {
    var db, db_file, options;
    db_file = "./test/test_save_cd.db";
    remove_file(db_file);
    options = {};
    options.core_data_mode = true;
    db = nosqlite.open(db_file, function() {
      var log;
      log = {
        text: "hello",
        occurred_at: new Date().getTime(),
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
        source: "string1",
        log_type: "string1",
        geo_lat: "string1",
        geo_long: "string1",
        metric: 5,
        external_id: 10,
        level: 5,
        readable_metric: "5 miles",
        facts: ["hello", "hello", "hello1"],
        original: {
          id: 1,
          text: "some crazy object"
        }
      };
      return db.save("log", log, function(err, res) {
        return assert.equal(res, "success", "should save single obj");
      });
    });
    return db;
  };
  test_update_object = function() {
    var db, db_file;
    db_file = "./test/test_update_object.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      var log;
      log = {
        text: "hello",
        created_at: new Date().getTime()
      };
      return db.save("log", log, false, function(err, res) {
        var object_hash;
        assert.equal(res.length, 1, "should save single obj");
        object_hash = res[0].hash;
        log = res[0];
        log.text = "hello1";
        return db.save("log", log, false, function(err, res) {
          assert.equal(res.length, 1, "should update single obj by adding a new");
          return assert.equal(res[0].parent, object_hash, "parent hash should be old version's hash");
        });
      });
    });
    return db;
  };
  test_save = function() {
    var db, db_file;
    db_file = "./test/test_save.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      var log;
      log = {
        text: "hello",
        created_at: new Date().getTime()
      };
      return db.save("log", log, function(err, sql_result_set) {
        return assert.equal(sql_result_set.rowsAffected, 1, "should save single obj");
      });
    });
    return db;
  };
  test_save_multiple = function() {
    var db, db_file;
    db_file = "./test/test_save_multiple.db";
    //remove_file(db_file)
    db = nosqlite.open(db_file, function() {
      var log, logs;
      logs = [
        (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string2",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        }), (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        }), (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        })
      ];
      return db.save("log", logs, false, function(err, res) {
        assert.equal(res.table_name, "log", "should save multiple obj and return commit object");
        return db.close();
      });
    });
    return db;
  };
  test_save_bulk = function() {
    var db, db_file, options;
    db_file = "./test/save_bulk.db";
    remove_file(db_file);
    options = {};
    db = nosqlite.open(db_file, function() {
      var _a, _b, i, log, logs;
      log = {
        text: "hello",
        occurred_at: new Date().getTime(),
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
        source: "string1",
        log_type: "string1",
        geo_lat: "string1",
        geo_long: "string1",
        metric: 5,
        external_id: 10,
        level: 5,
        readable_metric: "5 miles",
        facts: ["hello", "hello", "hello1"],
        original: {
          id: 1,
          text: "some crazy object"
        }
      };
      logs = [];
      _a = 1; _b = 200000;
      for (i = _a; (_a <= _b ? i <= _b : i >= _b); (_a <= _b ? i += 1 : i -= 1)) {
        logs.push(_.clone(log));
      }
      return db.save("log", logs, function(err, res) {
        return assert.equal(res.rowsAffected, 200000, "should save 250000 log messages quickly");
      });
    });
    return db;
  };
  test_objects_since_commit = function() {
    var db, db_file;
    db_file = "./test/test_objects_since_commit.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      var log, logs, logs2;
      logs = [
        (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        })
      ];
      logs2 = [
        (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        }), (log = {
          text: "hello2",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        })
      ];
      return db.save("log", logs, function(err, commit) {
        sys.debug(sys.inspect(commit));
        //assert.equal(commit, "hello", "should store the first commit")
        // store another commit
        return db.save("log", logs2, function(err1, commit2) {
          return db.objects_since_commit("log", commit.hash, function(err, objects) {
            assert.equal(objects.length, 2, "should pull 2 objects object");
            return db.close();
          });
        });
      });
    });
    return db;
  };
  test_fetch_commits = function() {
    var db, db_file;
    db_file = "./test/test_fetch_commits.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      var log, logs, logs2;
      logs = [
        (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        })
      ];
      logs2 = [
        (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        }), (log = {
          text: "hello2",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        })
      ];
      return db.save("log", logs, function(err, commit) {
        sys.debug(sys.inspect(commit));
        //assert.equal(commit, "hello", "should store the first commit")
        // store another commit
        return db.save("log", logs2, function(err1, commit2) {
          return db.fetch_commits(commit.hash, function(err, objects) {
            assert.equal(objects.length, 1, "should pull 1 commit");
            return db.close();
          });
        });
      });
    });
    return db;
  };
  test_find_or_save = function() {
    var db, db_file;
    db_file = "./test/test_find_or_save.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      var log, logs;
      logs = [
        (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        }), (log = {
          text: "hello",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        }), (log = {
          text: "hello2",
          occurred_at: new Date().getTime(),
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          source: "string1",
          log_type: "string1",
          geo_lat: "string1",
          geo_long: "string1",
          metric: 5,
          external_id: 10,
          level: 5,
          readable_metric: "5 miles",
          facts: ["hello", "hello", "hello1"],
          original: {
            id: 1,
            text: "some crazy object"
          }
        })
      ];
      return db.find_or_save("log", {
        text: "hello"
      }, logs, function(err, res) {
        assert.equal(res, 2, "should save not find these obj");
        return db.close();
      });
    });
    return db;
  };
  test_save_web = function() {
    var db, db_file;
    db_file = "./test/test_save_web.db";
    remove_file(db_file);
    //start the listener
    db = nosqlite.open(db_file, function() {
      var log, server, url;
      server = db.listen(5000);
      log = {
        text: "hello",
        occurred_at: new Date().getTime(),
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
        source: "string1",
        log_type: "string1",
        geo_lat: "string1",
        geo_long: "string1",
        metric: 5,
        external_id: 10,
        level: 5,
        readable_metric: "5 miles",
        facts: ["hello", "hello", "hello1"],
        original: {
          id: 1,
          text: "some crazy object"
        }
      };
      url = "http://localhost:5000?method=save&table=log";
      return rest.post(url, {
        data: JSON.stringify(log)
      }).addListener("complete", function(data) {
        var find_url, predicate;
        assert.equal(data, "success,", "should save record over http");
        predicate = {
          text: "hello"
        };
        find_url = "http://localhost:5000?method=find&table=log";
        data = [predicate, log];
        return rest.post(find_url, {
          data: JSON.stringify(data)
        }).addListener("complete", function(data) {
          assert.equal(data, JSON.stringify([log]), "should find record over http");
          return server.close();
        });
      });
    });
    return db;
  };
  test_migration = function() {
    var db, db_file;
    db_file = "./test/test_migration.db";
    remove_file(db_file);
    //create schema 1
    db = nosqlite.open(db_file, function() {
      var convert_callback, log;
      log = {
        text: "hello",
        occurred_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        source: "string1",
        log_type: "string1",
        geo_lat: "string1",
        geo_long: "string1",
        metric: 5,
        external_id: 10,
        level: 5,
        readable_metric: "5 miles",
        facts: ["hello", "hello", "hello1"],
        original: {
          id: 1,
          text: "some crazy object"
        }
      };
      convert_callback = function(old_obj) {
        old_obj.occurred_at = "you big dork";
        return old_obj;
      };
      return db.save("log", log, false, function(err, res) {
        return db.migrate_table("log", convert_callback, function(err, res) {
          (typeof err !== "undefined" && err !== null) ? sys.p(err) : null;
          return assert.equal(res, "success", "should migrate table from one schema to another");
        });
      });
    });
    return db;
  };
  peer1 = function() {
    var db, db_file;
    db_file = "./test/peer1.db";
    //remove_file db_file
    //start the listener
    db = nosqlite.open(db_file, function() {
      var server;
      server = db.listen(5000);
      return server;
    });
    return db;
  };
  peer2 = function() {
    var db, db_file;
    db_file = "./test/peer2.db";
    //remove_file db_file
    //start the listener
    db = nosqlite.open(db_file, function() {
      var server;
      server = db.listen(5001);
      return server;
    });
    return db;
  };
  test_pull = function() {
    var db, db_file;
    db_file = "./test/peer2.db";
    remove_file(db_file);
    db = nosqlite.open(db_file, function() {
      return db.add_remote("local1", "5000", "localhost", function(err, res) {
        return db.pull("local1", function(err, res) {
          if ((typeof err !== "undefined" && err !== null)) {
            throw err;
          }
          return assert.equal(res, "success", "should pull all new commits from remote source");
        });
      });
    });
    return db;
  };
  test_pull_again = function() {
    var db, db_file;
    db_file = "./test/peer2.db";
    db = nosqlite.open(db_file, function() {
      return db.pull("local1", function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        return assert.equal(res, "success", "should pull all new commits from remote source");
      });
    });
    return db;
  };
  test_add_remote = function() {
    var db, db_file;
    db_file = "./test/peer2.db";
    db = nosqlite.open(db_file, function() {
      return db.add_remote("local1", "5000", "localhost", function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
      });
    });
    return db;
  };
  // test_add_remote()
  // test_save_bulk()
  // peer1()
  // peer2()
  // test_pull()
  // test_pull_again()
  test_find();
  //test_find_or_save()
  //test_save()
  //test_update_object()
  //test_fetch_commits()
  //test_objects_since_commit()
  //test_save_multiple()
  //test_migration()
  //test_save_web()
})();
