(function(){
  var nosqlite, remove_file, sqlite, test_find, test_find_or_save, test_save, test_save_bulk, test_save_cd, test_save_multiple, test_save_web;
  var __hasProp = Object.prototype.hasOwnProperty;
  nosqlite = require("./nosqlite");
  sqlite = require("./sqlite");
  remove_file = function remove_file(file) {
    try {
      return fs.unlinkSync(file);
    } catch (err) {
      return puts(err);
    }
  };
  test_find = function test_find() {
    var db1, db_file, log;
    db_file = "./test/test_find.db";
    remove_file(db_file);
    db1 = nosqlite.connect(sqlite.openDatabaseSync(db_file));
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
    return db1.save("log", log, function(res) {
      return db1.find("log", {
        text: "hello"
      }, function(err, result) {
        return ok(result[0].text, "hello", "should find single object");
        //db.close()
      });
    });
  };
  test_save_cd = function test_save_cd() {
    var db, db_file, log, options;
    db_file = "./test/test_save_cd.db";
    remove_file(db_file);
    options = {};
    options.core_data_mode = true;
    db = nosqlite.connect(sqlite.openDatabaseSync(db_file), options);
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
      puts(res);
      return ok(res, "success", "should save single obj");
    });
  };
  test_save = function test_save() {
    var db, db_file, log;
    db_file = "./test/test_save.db";
    remove_file(db_file);
    db = nosqlite.connect(sqlite.openDatabaseSync(db_file));
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
      puts(res);
      return ok(res, "success", "should save single obj");
    });
  };
  test_save_multiple = function test_save_multiple() {
    var db, db_file, log, logs;
    db_file = "./test/test_save_multiple.db";
    remove_file(db_file);
    db = nosqlite.connect(sqlite.openDatabaseSync(db_file));
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
    return db.save("log", logs, function(err, res) {
      ok(res, "success", "should save multiple obj");
      return db.close();
    });
  };
  test_save_bulk = function test_save_bulk() {
    var _a, _b, _c, _d, _e, all_keys, db, db_file, i, key, l, log, logs, options;
    db_file = "./test/test_save_bulk.db";
    remove_file(db_file);
    options = {};
    options.add_guid = true;
    db = nosqlite.connect(sqlite.openDatabaseSync(db_file), options);
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
      l = _.clone(log);
      all_keys = [];
      _e = l;
      for (key in _e) { if (__hasProp.call(_e, key)) {
        all_keys.push(key);
      }}
      l.hash = hashlib.md5(all_keys.join(","));
      logs.push(l);
    }
    return db.save("log", logs, function(err, res) {
      ok(res, "success", "should save 25,000 log messages quickly");
      return db.close();
    });
  };
  test_find_or_save = function test_find_or_save() {
    var db, db_file, log, logs;
    db_file = "./test/test_find_or_save.db";
    remove_file(db_file);
    db = nosqlite.connect(sqlite.openDatabaseSync(db_file));
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
      ok(res, 2, "should save not find these obj");
      return db.close();
    });
  };
  test_save_web = function test_save_web() {
    var db, db_file, log, rest, server, url;
    db_file = "./test/test_save_web.db";
    remove_file(db_file);
    if (!(typeof rest !== "undefined" && rest !== null)) {
      rest = require("restler");
    }
    //start the listener
    db = nosqlite.connect(sqlite.openDatabaseSync(db_file));
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
    puts("Invoking " + (url));
    return rest.post(url, {
      data: JSON.stringify(log)
    }).addListener("complete", function(data) {
      var find_url, predicate;
      ok(data, "success,", "should save record over http");
      predicate = {
        text: "hello"
      };
      find_url = "http://localhost:5000?method=find&table=log";
      data = [predicate, log];
      return rest.post(find_url, {
        data: JSON.stringify(data)
      }).addListener("complete", function(data) {
        ok(data, JSON.stringify([log]), "should find record over http");
        return server.close();
      });
    });
  };
  test_save();
  test_save_multiple();
  test_find();
  test_find_or_save();
  test_save_web();
})();
