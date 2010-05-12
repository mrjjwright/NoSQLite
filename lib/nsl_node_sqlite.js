(function(){
  var NSLNodeSQLite, NSLNodeSQLiteDatabase, sqlite, sys;
  // A HTML5 web database wrapper around the Node SQLite class
  // NoSQLite runs on node.js, the browser, and on the iPhone/iPad
  // all of which interface to SQLite a bit differently.
  // The asynchronous HTML5 web database API was chosen as a standard for all 3
  // since it was the most restrictive.
  // See: http://dev.w3.org/html5/webdatabase/
  // All of these functions are attached to the NoSQLite object
  // so "this" will refer to NoSQLite
  sqlite = require("sqlite");
  sys = require("sys");
  NSLNodeSQLite = function NSLNodeSQLite() {  };
  NSLNodeSQLite.prototype.openDatabase = function openDatabase(name, version, displayName, estimatedSize, callback) {
    try {
      this.db = new sqlite.Database();
      return this.db.open(name, function(err) {
        if ((typeof callback !== "undefined" && callback !== null)) {
          return callback();
        }
      });
    } catch (err) {
      return handleError(err);
    }
  };
  NSLNodeSQLiteDatabase = function NSLNodeSQLiteDatabase() {  };
  // Should begin an transaction
  // Any errors thrown should not terminate the transaction
  NSLNodeSQLiteDatabase.prototype.transaction = function transaction(start, failure, success) {
    throw new Error("abstract");
  };
  // Executes a sql, with the supplied bindings
  // Implemtors should cache all statements and re-use them if possible.
  // sql can either be an escaped sql, or sql with ? placeholders.
  // optional bindings is an array of params in the right order
  // optional callback(transaction, resultSet)
  // optional errorCallback(transaction,error)
  NSLNodeSQLiteDatabase.prototype.executeSQL = function executeSQL(sql, bindings, callback, errorCallback) {
    throw new Error("abstract");
  };
  (typeof require !== "undefined" && require !== null) && (typeof exports !== "undefined" && exports !== null) ? (exports.nsl_node_sqlite = new NSLNodeSQLite()) : null;
})();
