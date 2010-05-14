(function(){
  var NoSQLite, _a, nsl_console, nsl_debug, nsl_sqlite_wrapper, root, sys;
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
    // A nsl_sqlite_wrapper is an object that wraps
    // another SQLite driver with an HTML 5 web db interface
    nsl_sqlite_wrapper = require("./nsl_node_sqlite").nsl_node_sqlite;
    sys = require("sys");
    require("underscore");
    nsl_debug = sys.debug;
  } else if ((typeof window !== "undefined" && window !== null)) {
    // Running in the browser
    //Assume that all the required libs are bundled into a single file
    nsl_console = console;
    if ((typeof (_a = window.openDatabase) !== "undefined" && _a !== null) && !(typeof nsl_cocoa !== "undefined" && nsl_cocoa !== null)) {
      nsl_sqlite_wrapper = window;
    } else if ((typeof nsl_cocoa !== "undefined" && nsl_cocoa !== null)) {
      // Running inside a hidden webkit control inside a Cocoa app
      nsl_sqlite_wrapper = nsl_cocoa_sqli;
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
  // Opens a database
  // name: the name of a db, or the full path to a db file
  // options: (optional) the NoSQLite options
  // callback: (optional) a callback method to use if the call succeeded
  NoSQLite.prototype.open = function open(name, options, callback) {
    if ((typeof options !== "undefined" && options !== null)) {
      this.options = _.extend(this.options, options);
    }
    this.openDatabase(name, null, null, null, callback);
    return this;
  };
  // Opens the database
  // Name to be the complete path to the db if it makes sense
  // Also providers can ignore the version attribute
  NoSQLite.prototype.openDatabase = function openDatabase(name, version, displayName, estimatedSize, callback) {
    try {
      this.db = nsl_sqlite_wrapper.openDatabase(name, version, displayName, estimatedSize, callback);
      return this;
    } catch (err) {
      handleError(err);
    }
  };
  // Sets a function to call onError
  NoSQLite.prototype.onError = function onError(handler) {
    var handleError;
    this.errorHandler = handler;
    handleError = function handleError(err) {
      if ((typeof errorHandler !== "undefined" && errorHandler !== null)) {
        return errorHandler(err);
      }
    };
    return handleError;
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
  // The rest of the functions on NoSQLite are
  // attached to the NoSQLite prototype after
  // the below CommonJS code executes
  if ((typeof require !== "undefined" && require !== null)) {
    require("./nsl_sql");
    require("./nsl_core");
  }
  // In a browser enviroment, the rest of the NoSQLite functions are
  // bundled below here in a single JS file
})();
