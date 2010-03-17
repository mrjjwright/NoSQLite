(function(){
  var core_data_create_sql, log, predicate, simple_obj, sql, table_sql, table_sql_guid;
  sql = require("sql");
  ok(sql.convert_to_sqlite(null), "NULL", "null should convert to NULL");
  ok(sql.convert_to_sqlite(45), 45, "Number should convert to number without quotes");
  ok(sql.convert_to_sqlite(true), "'true'", "Boolean true should convert to true");
  ok(sql.convert_to_sqlite(false), "'false'", "Boolean false should convert to false");
  puts("testing convert_from_sqlite");
  ok(sql.convert_from_sqlite("value"), "value", "if no prototype_value should return value");
  ok(sql.convert_from_sqlite("NULL"), null, "if NULL value should return null");
  ok(sql.convert_from_sqlite("2"), 2, "a number should return number");
  ok(sql.convert_from_sqlite("true", true), true, "if Boolean prototype value should parse as Boolean");
  simple_obj = {
    test: "hello"
  };
  ok(sql.convert_from_sqlite(JSON.stringify(simple_obj), simple_obj), simple_obj, "if simple Object should return Object");
  puts("testing select");
  ok(sql.select("log", {
    "external_id": 45
  }).escaped, "select rowid, * from log where(external_id = 45)", "should handle value = number");
  ok(sql.select("log", {
    "external_id": "45"
  }).escaped, "select rowid, * from log where(external_id = '45')", "should handle value = string");
  ok(sql.select("log", {
    "external_id": true
  }).escaped, "select rowid, * from log where(external_id = 'true')", "should handle predicate value = true");
  ok(sql.select("log", {
    "external_id": false
  }).escaped, "select rowid, * from log where(external_id = 'false')", "should handle predicate value = false");
  ok(sql.select("log", {
    "external_id": false
  }).placeholder, "select rowid, * from log where(external_id = ?)", "placeholder property should be set");
  ok(sql.select("log", {
    "external_id": false
  }).values.length, 1, "values property should be array of right size");
  ok(sql.select("log", {}).escaped, "select rowid, * from log", "empty object predicate should leave off where clause");
  ok(sql.select("log", []).escaped, "select rowid, * from log", "empty array predicate should leave off where clause");
  ok(sql.select("log", {
    "external_id": 45
  }, true).escaped, "select rowid, * from ZLOG where(ZEXTERNALID = 45)", "should convert to Core Data mode");
  puts("testing insert");
  ok(sql.insert("log", {
    text: "hello",
    log_type: "mumble"
  }).placeholder, "insert or replace into log(text,log_type) values (?,?)", "insert placeholder should be correct");
  ok(sql.insert("log", {
    text: "hello",
    log_type: "mumble"
  }).escaped, "insert or replace into log(text,log_type) values ('hello','mumble')", "insert escaped should be correct");
  ok(sql.insert("log", {
    text: "hello",
    log_type: "mumble"
  }, true).placeholder, "insert or replace into ZLOG(ZTEXT,ZLOGTYPE) values (?,?)", "should produce valid insert SQL for Core Data mode");
  puts("testing create table");
  log = {
    text: "hello",
    updated_at: new Date().getTime(),
    source: "string1",
    metric: 5,
    readable_metric: true,
    keys: ["hello", "hello", "hello1"],
    original: {
      id: 1,
      text: "some crazy object"
    }
  };
  table_sql = 'create table log("text" TEXT,"updated_at" NUMERIC,"source" TEXT,"metric" NUMERIC,"readable_metric" TEXT,"keys" TEXT,"original" TEXT);';
  ok(sql.create_table("log", log).sql, table_sql, "should create simple create sql");
  core_data_create_sql = 'create table ZLOG("Z_PK" INTEGER PRIMARY KEY AUTOINCREMENT,"Z_ENT" INTEGER,"Z_OPT" INTEGER,"ZTEXT" TEXT,"ZUPDATEDAT" NUMERIC,"ZSOURCE" TEXT,"ZMETRIC" NUMERIC,"ZREADABLEMETRIC" TEXT,"ZKEYS" TEXT,"ZORIGINAL" TEXT);';
  ok(sql.create_table("log", log, true).sql, core_data_create_sql, "should create core data sql create table sql properly");
  table_sql_guid = 'create table log("text" TEXT,"updated_at" NUMERIC,"source" TEXT,"metric" NUMERIC,"readable_metric" TEXT,"keys" TEXT,"original" TEXT,"guid" VARCHAR UNIQUE NOT NULL);';
  log.guid = "x";
  ok(sql.create_table("log", log).sql, table_sql_guid, "should create unique column for guid");
  puts("testing alter table");
  ok(sql.add_column("log", "col1", "NUMERIC").sql, "alter table 'log' add column 'col1' NUMERIC", "should produce valid add column sql");
  ok(sql.add_column("log", "col1", "NUMERIC", true).sql, "alter table 'ZLOG' add column 'ZCOL1' NUMERIC", "should produce valid add column sql for Core Data");
  puts("testing populate_predicate");
  predicate = sql.populate_predicate({
    external_id: 45
  }, {
    some_other: 33,
    external_id: 46
  });
  ok(predicate, {
    external_id: 46
  }, "should populate simple name, value objects correctly");
  predicate = sql.populate_predicate({
    "external_id <": 45
  }, {
    some_other: 33,
    external_id: 46
  });
  ok(predicate, {
    "external_id <": 46
  }, "should populate keys with operators correctly");
})();
