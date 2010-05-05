(function(){
  var assert, fs, nosqlite, peer1, peer2, remove_file, sqlite, sys, test_add_remote, test_fetch_commits, test_find, test_find_or_save, test_migration, test_objects_since_commit, test_pull, test_save, test_save_bulk, test_save_cd, test_save_multiple, test_save_web, test_update_object;
  nosqlite = require("../nosqlite");
  sqlite = require("../sqlite");
  sys = require("sys");
  fs = require("fs");
  assert = require("assert");
  remove_file = function remove_file(file) {
    try {
      return fs.unlinkSync(file);
    } catch (err) {
      return sys.puts(err);
    }
  };
  test_find = function test_find() {
    var db, db_file;
    db_file = "./test/test_find.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
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
      return db.save("log", log, function(res) {
        return db.find("log", {
          text: "hello"
        }, function(err, result) {
          return db.close(function() {
            return assert.equal(result.text, "hello", "should find single object");
          });
        });
      });
    });
    return db;
  };
  test_save_cd = function test_save_cd() {
    var db, db_file, options;
    db_file = "./test/test_save_cd.db";
    remove_file(db_file);
    options = {};
    options.core_data_mode = true;
    db = nosqlite.connect(db_file, function() {
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
  test_update_object = function test_update_object() {
    var db, db_file;
    db_file = "./test/test_update_object.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
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
          assert.equal(res[0].parent, object_hash, "parent hash should be old version's hash");
          return db.close();
        });
      });
    });
    return db;
  };
  test_save = function test_save() {
    var db, db_file;
    db_file = "./test/test_save.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
      var log;
      log = {
        text: "hello",
        created_at: new Date().getTime()
      };
      return db.save("log", log, false, function(err, res) {
        assert.equal(res, "success", "should save single obj");
        return db.close();
      });
    });
    return db;
  };
  test_save_multiple = function test_save_multiple() {
    var db, db_file;
    db_file = "./test/test_save_multiple.db";
    //remove_file(db_file)
    db = nosqlite.connect(db_file, function() {
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
  test_save_bulk = function test_save_bulk() {
    var db, db_file, options;
    db_file = "./test/test_save_bulk.db";
    remove_file(db_file);
    options = {};
    db = nosqlite.connect(db_file, options, function() {
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
      return db.save("log", logs, false, function(err, res) {
        assert.equal(res, "success", "should save 250000 log messages quickly");
        return db.close();
      });
    });
    return db;
  };
  test_objects_since_commit = function test_objects_since_commit() {
    var db, db_file;
    db_file = "./test/test_objects_since_commit.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
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
  test_fetch_commits = function test_fetch_commits() {
    var db, db_file;
    db_file = "./test/test_fetch_commits.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
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
  test_find_or_save = function test_find_or_save() {
    var db, db_file;
    db_file = "./test/test_find_or_save.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
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
  test_save_web = function test_save_web() {
    var db, db_file;
    db_file = "./test/test_save_web.db";
    remove_file(db_file);
    //start the listener
    db = nosqlite.connect(db_file, function() {
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
  test_migration = function test_migration() {
    var db, db_file;
    db_file = "./test/test_migration.db";
    remove_file(db_file);
    //create schema 1
    db = nosqlite.connect(db_file, function() {
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
      convert_callback = function convert_callback(old_obj) {
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
  peer1 = function peer1() {
    var db, db_file;
    db_file = "./test/peer1.db";
    remove_file(db_file);
    //start the listener
    db = nosqlite.connect(db_file, function() {
      var server;
      server = db.listen(5000);
      return server;
    });
    return db;
  };
  peer2 = function peer2() {
    var db, db_file;
    db_file = "./test/peer2.db";
    //remove_file db_file
    //start the listener
    db = nosqlite.connect(db_file, function() {
      var server;
      server = db.listen(5001);
      return server;
    });
    return db;
  };
  test_pull = function test_pull() {
    var db, db_file;
    db_file = "./test/peer2.db";
    remove_file(db_file);
    db = nosqlite.connect(db_file, function() {
      return db.add_remote("local1", "5000", "localhost", function(err, res) {
        return db.pull("local1", function(err, res) {
          return sys.debug(err);
        });
      });
    });
    return db;
  };
  test_add_remote = function test_add_remote() {
    var db, db_file;
    db_file = "./test/peer2.db";
    db = nosqlite.connect(db_file, function() {
      return db.add_remote("local1", "5000", "localhost", function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
      });
    });
    return db;
  };
  //test_add_remote()
  //peer1()
  //peer2()
  test_pull();
  //test_find()
  //test_find_or_save()
  //test_save()
  //test_update_object()
  //test_fetch_commits()
  //test_objects_since_commit()
  //test_save_multiple()
  //test_migration()
  //test_save_bulk()
  //test_save_web()
})();
