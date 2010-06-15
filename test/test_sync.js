(function(){
  var assert, flow, fs, nosqlite, remove_file, sys, test_pull;
  require.paths.unshift("vendor");
  sys = require("sys");
  nosqlite = require("../lib/index");
  fs = require("fs");
  flow = require("flow");
  assert = require("assert");
  remove_file = function(file) {
    try {
      return fs.unlinkSync(file);
    } catch (err) {
      return sys.puts(err);
    }
  };
  test_pull = function() {
    var db, db_file;
    db_file = "./test/test_pull.db";
    //remove_file(db_file)
    db = nosqlite.open(db_file, {
      sync_mode: true
    }, function() {
      var log, log_desc, schema;
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
      log_desc = {
        table: "log",
        objs: [log]
      };
      //create a schema
      schema = [
        {
          table: "log",
          objs: [log]
        }
      ];
      return flow.exec(function() {
        return db.create_schema(schema, this);
      }, function(err) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        return db.pull("http://localhost:3000/nsl/pull", "test_sync.db", this);
      }, function(err, results) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
      });
    });
    return db;
  };
  test_pull();
})();
