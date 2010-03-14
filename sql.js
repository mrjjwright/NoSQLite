(function(){
  var SQL, fs, sys;
  var __hasProp = Object.prototype.hasOwnProperty;
  sys = require('sys');
  fs = require("fs");
  require("underscore");
  // A simple DSL for creating SQL statements frorm and for JS to SQLLite
  SQL = function SQL(core_data_mode) {
    this.values = [];
    this.values_escaped = [];
    this.columns = [];
    this.core_data_mode = core_data_mode;
    return this;
  };
  SQL.prototype.select = function select(table, predicate) {
    var _a, _b, _c, _d, ands_escaped, ands_placeholder, key, key_sql, predicates, sql;
    sql = "select rowid, * from " + this.sql_name(table);
    if ((!(typeof predicate !== "undefined" && predicate !== null)) || _.isEmpty(predicate)) {
      this.escaped = sql;
      this.placeholder = sql;
      return this;
    }
    sql += " where";
    predicates = [];
    // allow the user to pass in a single object or multiple objects
    !_.isArray(predicate) ? predicates.push(predicate) : (predicates = predicate);
    // generate the where clauses from what is passed in
    ands_escaped = [];
    ands_placeholder = [];
    _a = predicates;
    for (_b = 0, _c = _a.length; _b < _c; _b++) {
      predicate = _a[_b];
      _d = predicate;
      for (key in _d) { if (__hasProp.call(_d, key)) {
        key_sql = this.key_to_sql(key);
        this.values_escaped.push(this.convert_to_sqlite(predicate[key]));
        ands_escaped.push(key_sql + this.convert_to_sqlite(predicate[key]));
        ands_placeholder.push(key_sql + "?");
        this.values.push(predicate[key]);
      }}
    }
    this.escaped = sql + "(" + ands_escaped.join(" AND ") + ")";
    this.placeholder = sql + "(" + ands_placeholder.join(" AND ") + ")";
    return this;
  };
  SQL.prototype.insert = function insert(table, obj) {
    var _a, columns_sep, key, question_marks, sql;
    sql = "insert or replace into " + this.sql_name(table);
    question_marks = [];
    _a = obj;
    for (key in _a) { if (__hasProp.call(_a, key)) {
      this.values.push(obj[key]);
      this.values_escaped.push(this.convert_to_sqlite(obj[key]));
      this.columns.push(this.sql_name(key));
      question_marks.push("?");
    }}
    columns_sep = this.columns.join(",");
    this.placeholder = sql + "(" + columns_sep + ") values (" + question_marks.join(",") + ")";
    this.escaped = sql + "(" + columns_sep + ") values (" + this.values_escaped.join(",") + ")";
    return this;
  };
  // returns SQLite based sql for creating a table based on an object
  // uses JS info about each column to make some intelligent choices for a table
  // SQLite doesn't care too much what types we use in the sql "create table"
  // see http://www.sqlite.org/datatype3.html
  // it's more important when saving or reading JS Objects
  // Here is the simple mappings between JS objects and SQLite "type affinities" for sql:
  // JS Number -> SQLite NUMERIC
  // JS Date -> SQLite NUMERIC (can use Unix epoch)
  // all others use TEXT, when reading them in we try diff
  SQL.prototype.create_table = function create_table(table, obj) {
    var _a, key, type, value;
    this.sql = "create table " + this.sql_name(table);
    this.columns = [];
    if (this.core_data_mode === true) {
      this.columns.push("\"Z_PK\" INTEGER PRIMARY KEY AUTOINCREMENT");
      this.columns.push("\"Z_ENT\" INTEGER");
      this.columns.push("\"Z_OPT\" INTEGER");
    }
    _a = obj;
    for (key in _a) { if (__hasProp.call(_a, key)) {
      value = obj[key];
      type = _.isNumber(value) || _.isDate(value) ? "NUMERIC" : "TEXT";
      this.columns.push("\"" + this.sql_name(key) + "\" " + type);
    }}
    this.sql += "(" + this.columns.join(",") + ");";
    return this;
  };
  // returns add_column sql for SQLite
  // see http://www.sqlite.org/lang_altertable.html
  SQL.prototype.add_column = function add_column(table, column, type) {
    this.sql = "alter table '" + this.sql_name(table) + "' add column '" + this.sql_name(column) + "'";
    if ((typeof type !== "undefined" && type !== null)) {
      this.sql = this.sql + " " + type;
    }
    return this;
  };
  SQL.prototype.key_to_sql = function key_to_sql(key) {
    var operand, operator, p;
    p = key.indexOf(' ');
    if (p === -1) {
      return this.sql_name(key) + " = ";
    }
    operator = key.substr(p + 1);
    operand = key.substr(0, p);
    if ((['<', '>', '=', '<=', '>=', '!=', '<>'].indexOf(operator) >= 0)) {
      return this.sql_name(operand) + " " + operator + " ";
    }
    if (operator === '%') {
      return this.sql_name(operand) + " LIKE ";
    }
    throw "Invalid operator " + operator;
  };
  // takes a predicate and populates it with values from the obj
  // instead of the template values on it
  SQL.prototype.populate_predicate = function populate_predicate(predicate, obj) {
    var _a, _b, _c, _d, cloned_predicate, key, operand, p, populated_predicates, predicates;
    predicates = [];
    populated_predicates = [];
    //allow the user to pass in a single predicates or multiple predicates
    !_.isArray(predicate) ? predicates.push(predicate) : (predicates = predicate);
    _a = predicates;
    for (_b = 0, _c = _a.length; _b < _c; _b++) {
      predicate = _a[_b];
      cloned_predicate = _.clone(predicate);
      _d = predicate;
      for (key in _d) { if (__hasProp.call(_d, key)) {
        // operands can come with operators, eg. 'col <'
        // or leave it off, implied "=" operator
        p = key.indexOf(' ');
        operand = p === -1 ? key : key.substr(0, p);
        cloned_predicate[key] = obj[operand];
      }}
      populated_predicates.push(cloned_predicate);
    }
    if (!_.isArray(predicate)) {
      return populated_predicates[0];
    }
    return populated_predicates;
  };
  // Checks if in Core Data mode
  // converts the name to uppercase and prepends a Z if so
  // else just returns the name
  SQL.prototype.sql_name = function sql_name(sql_name) {
    if (this.core_data_mode === true) {
      sql_name = sql_name.replace(/_/g, "");
      return "Z" + (sql_name.toUpperCase());
    }
    return sql_name;
  };
  SQL.prototype.convert_to_sqlite = function convert_to_sqlite(value) {
    var str_value;
    if (!(typeof value !== "undefined" && value !== null)) {
      return "NULL";
    }
    // sqlite requires strings to be enclosed in single ticks and single ticks within
    // the string to be escaped with double single ticks
    // see http://www.sqlite.org/lang_expr.html
    if (_.isNumber(value) === true) {
      return value;
    }
    //if _.isDate(value) is true then return value.toString()
    if (_.isString(value) === true) {
      str_value = value.replace(/\'/g, "''");
      return "'" + str_value + "'";
    }
    return "'" + JSON.stringify(value).replace("'", "''") + "'";
  };
  SQL.prototype.convert_from_sqlite = function convert_from_sqlite(value, prototype_value) {
    if (_.isString(value) && value === "NULL") {
      return null;
    }
    //next we try to parse this as JSON
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  };
  process.mixin(exports, {
    select: function select(table, predicate, core_data_mode) {
      return new SQL(core_data_mode).select(table, predicate);
    },
    insert: function insert(table, obj, core_data_mode) {
      return new SQL(core_data_mode).insert(table, obj);
    },
    create_table: function create_table(table, obj, core_data_mode) {
      return new SQL(core_data_mode).create_table(table, obj);
    },
    add_column: function add_column(table, column, type, core_data_mode) {
      return new SQL(core_data_mode).add_column(table, column, type);
    },
    convert_to_sqlite: function convert_to_sqlite(value, core_data_mode) {
      return new SQL(core_data_mode).convert_to_sqlite(value);
    },
    convert_from_sqlite: function convert_from_sqlite(value, prototype_value, core_data_mode) {
      return new SQL(core_data_mode).convert_from_sqlite(value, prototype_value);
    },
    populate_predicate: function populate_predicate(predicate, obj, core_data_mode) {
      return new SQL(core_data_mode).populate_predicate(predicate, obj);
    }
  });
})();
