(function(){
  var assert, fs, nosqlite, remove_file, sqlite, sys, test_find, test_find_or_save, test_save, test_save_bulk, test_save_cd, test_save_multiple, test_save_web;
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
    return db = nosqlite.connect(db_file, function() {
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
            return assert.ok(result.text, "hello", "should find single object");
          });
        });
      });
    });
  };
  test_save_cd = function test_save_cd() {
    var db, db_file, options;
    db_file = "./test/test_save_cd.db";
    remove_file(db_file);
    options = {};
    options.core_data_mode = true;
    return db = nosqlite.connect(db_file, function() {
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
        return assert.ok(res, "success", "should save single obj");
      });
    });
  };
  test_save = function test_save() {
    var db, db_file;
    db_file = "./test/test_save.db";
    remove_file(db_file);
    return db = nosqlite.connect(db_file, function() {
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
      return db.save("log", log, false, function(err, res) {
        assert.ok(res, "success", "should save single obj");
        return db.close();
      });
    });
  };
  test_save_multiple = function test_save_multiple() {
    var db, db_file;
    db_file = "./test/test_save_multiple.db";
    remove_file(db_file);
    return db = nosqlite.connect(db_file, function() {
      var log, logs;
      logs = [(log = {
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
        assert.ok(res, "success", "should save multiple obj");
        return db.close();
      });
    });
  };
  test_save_bulk = function test_save_bulk() {
    var db, db_file, options;
    db_file = "./test/test_save_bulk.db";
    remove_file(db_file);
    options = {};
    options.no_guid = true;
    return db = nosqlite.connect(db_file, function() {
      var _a, _b, _c, _d, i, log, logs, nosqlite_db;
      nosqlite_db = nosqlite.connect(db, options);
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
      _c = 1; _d = 250000;
      for (_b = 0, i = _c; (_c <= _d ? i <= _d : i >= _d); (_c <= _d ? i += 1 : i -= 1), _b++) {
        logs.push(_.clone(log));
      }
      return db.save("log", logs, false, function(err, res) {
        assert.ok(res, "success", "should save 250000 log messages quickly");
        return db.close();
      });
    });
  };
  test_find_or_save = function test_find_or_save() {
    var db, db_file;
    db_file = "./test/test_find_or_save.db";
    remove_file(db_file);
    return db = nosqlite.connect(db_file, function() {
      var log, logs;
      logs = [(log = {
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
        assert.ok(res, 2, "should save not find these obj");
        return db.close();
      });
    });
  };
  test_save_web = function test_save_web() {
    var db, db_file, rest;
    db_file = "./test/test_save_web.db";
    remove_file(db_file);
    if (!(typeof rest !== "undefined" && rest !== null)) {
      rest = require("restler");
    }
    //start the listener
    return db = nosqlite.connect(db_file, function() {
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
        assert.ok(data, "success,", "should save record over http");
        predicate = {
          text: "hello"
        };
        find_url = "http://localhost:5000?method=find&table=log";
        data = [predicate, log];
        return rest.post(find_url, {
          data: JSON.stringify(data)
        }).addListener("complete", function(data) {
          assert.ok(data, JSON.stringify([log]), "should find record over http");
          return server.close();
        });
      });
    });
  };
  test_find();
  test_find_or_save();
  test_save();
  test_save_multiple();
  //test_save_web()
})();
