(function(){
  $(document).ready(function() {
    module("Core functions");
    return asyncTest("save", function() {
      var db, log;
      db = nosqlite.open("nosqlite_test", {
        sync_mode: true
      });
      ok(db.transaction, "Should create a db object with a transaction method");
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
      db.save("log", log, function(err, res) {
        if ((typeof err !== "undefined" && err !== null)) {
          throw err;
        }
        return db.find("log", {
          text: "hello"
        }, function(err, result) {
          console.debug(err);
          equals(result[0].text, "hello", "should find single object");
          equals(result[0].facts[2], "hello1", "should recreate arrays");
          return equals(result[0].original.id, 1, "should recreate complex objects");
        });
      });
      return start();
    });
  });
})();
