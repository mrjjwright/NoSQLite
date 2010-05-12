(function(){
  var NoSQLite, _a, nsl_console, nsl_debug, nsl_open_db, root;
  // NoSQLite - SQLite for Javascript
  // (c) 2010 John J. Wright
  // NoSQLite is freely distributable under the terms of the MIT license.
  // For all details and documentation:
  // http://github.com/mrjjwright
  //
  // -------------------------------------------------------------------
  // A library to make it as easy as possible to store and retrieve JS objects
  // from SQLite. Zero-configuration!
  // Attempts to work with JS objects as intelligently as possible in SQLite.
  if (!(typeof window !== "undefined" && window !== null) && (typeof require !== "undefined" && require !== null)) {
    // Running in a CommonJS environment like Node.js
    nsl_open_db = require("./nsl_node_sqlite").openDatabase;
    nsl_debug = require("sys").debug;
  } else if ((typeof window !== "undefined" && window !== null)) {
    // Running in the browser
    //Assume that all the required libs are bundled into a single file
    nsl_console = console;
    if ((typeof (_a = window.openDatabase) !== "undefined" && _a !== null) && !(typeof nsl_cocoa !== "undefined" && nsl_cocoa !== null)) {
      nsl_open_db = window.openDatabase;
    } else if ((typeof nsl_cocoa !== "undefined" && nsl_cocoa !== null)) {
      // Running inside a hidden webkit control inside a Cocoa app
      nsl_open_db = nsl_cocoa.openDatabase;
    } else {
      throw Error("Unsupported browser.  Does not support HTML5 Web API.");
    }
  }
  NoSQLite = function NoSQLite() {
    this.table_descriptions = [];
    this.options = {
      core_data_mode: false,
      safe_mode: true
    };
    return this;
  };
  // Pass in a path to a sqlite file
  // Pass in an optional Core Data compatible mode flag.
  // params:
  // * path to db.
  // * (optional) If set to `true` will create a core data compatible schema.
  NoSQLite.prototype.openDatabase = function openDatabase(name, version, displayName, estimatedSize, callback) {
    this.db = nsl_open_db.apply(root, arguments);
    return this.db;
  };
  // closes the underlying SQLite connection
  NoSQLite.prototype.close = function close() {
    return this.db.close(function() {    });
  };
  String.prototype.trim = function trim() {
    return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1");
  };
  root = (typeof exports !== "undefined" && exports !== null) ? exports : window;
  root.nosqlite = new NoSQLite();
  root.NoSQLite = NoSQLite;
  if ((typeof require !== "undefined" && require !== null)) {
    require("./nsl_sql");
    require("./nsl_core");
  }
})();
