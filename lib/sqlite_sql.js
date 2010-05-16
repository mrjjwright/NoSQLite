(function(){
  var SQL, root;
  var __hasProp = Object.prototype.hasOwnProperty;
  // A simple DSL for creating SQL statements to and from JS to SQLLite
  SQL = function(core_data_mode) {
    this.bindings = [];
    this.bindings_escaped = [];
    this.columns = [];
    this.core_data_mode = core_data_mode === true;
    return this;
  };
  SQL.prototype.select = function(table, predicate) {
    var _a, _b, _c, _d, ands_escaped, ands_index_placeholder, ands_name_placeholder, key, key_sql, predicates, sql;
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
    ands_index_placeholder = [];
    ands_name_placeholder = [];
    _b = predicates;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      predicate = _b[_a];
      _d = predicate;
      for (key in _d) { if (__hasProp.call(_d, key)) {
        key_sql = this.key_to_sql(key);
        this.bindings_escaped.push(this.convert_to_sqlite(predicate[key]));
        ands_escaped.push(key_sql + this.convert_to_sqlite(predicate[key]));
        ands_index_placeholder.push(key_sql + "?");
        ands_name_placeholder.push(key_sql + (":" + (key)));
        this.bindings.push(predicate[key]);
      }}
    }
    this.escaped = sql + "(" + ands_escaped.join(" AND ") + ")";
    this.index_placeholder = sql + "(" + ands_index_placeholder.join(" AND ") + ")";
    this.name_placeholder = sql + "(" + ands_name_placeholder.join(" AND ") + ")";
    return this;
  };
  SQL.prototype.insert = function(table, obj, replace) {
    var _a, columns_sep, key, names, question_marks, sql;
    sql = "insert ";
    if (replace) {
      sql = sql + " or replace ";
    }
    sql = sql + "into " + this.sql_name(table);
    question_marks = [];
    names = [];
    _a = obj;
    for (key in _a) { if (__hasProp.call(_a, key)) {
      this.bindings.push(obj[key]);
      this.bindings_escaped.push(this.convert_to_sqlite(obj[key]));
      this.columns.push(this.sql_name(key));
      question_marks.push("?");
      names.push((":" + (key)));
    }}
    columns_sep = this.columns.join(",");
    this.index_placeholder = sql + "(" + columns_sep + ") values (" + question_marks.join(",") + ")";
    this.name_placeholder = sql + "(" + columns_sep + ") values (" + names.join(", ") + ")";
    this.escaped = sql + "(" + columns_sep + ") values (" + this.bindings_escaped.join(",") + ")";
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
  SQL.prototype.create_table = function(table, obj) {
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
      if (key === "rowid") {
        continue;
      }
      value = obj[key];
      type = _.isNumber(value) || _.isDate(value) ? "NUMERIC" : "TEXT";
      key === "guid" ? (type = "VARCHAR UNIQUE NOT NULL") : null;
      this.columns.push("\"" + this.sql_name(key) + "\" " + type);
    }}
    this.sql += "(" + this.columns.join(",") + ");";
    return this;
  };
  // create temp table sql.
  // We create it with the same number of cols as the old table
  // We don't care about the types
  SQL.prototype.create_temp_table = function(table, obj) {
    var _a, _b, key, keys, temp_cols;
    // execute a pragma to get the number of cols in the old table
    keys = (function() {
      _a = []; _b = obj;
      for (key in _b) { if (__hasProp.call(_b, key)) {
        _a.push(key);
      }}
      return _a;
    })();
    keys = _.reject(keys, function(key) {
      return key === "rowid";
    });
    temp_cols = keys.join(",");
    return ("create temporary table " + (table) + "_backup(" + (temp_cols) + ");");
  };
  // returns add_column sql for SQLite
  // see http://www.sqlite.org/lang_altertable.html
  SQL.prototype.add_column = function(table, column, type) {
    this.sql = "alter table '" + this.sql_name(table) + "' add column '" + this.sql_name(column) + "'";
    if ((typeof type !== "undefined" && type !== null)) {
      this.sql = this.sql + " " + type;
    }
    return this;
  };
  SQL.prototype.key_to_sql = function(key) {
    var operand, operator, p;
    p = key.indexOf(' ');
    if (p === -1) {
      return this.sql_name(key) + " = ";
    }
    operator = key.substr(p + 1).trim();
    operand = key.substr(0, p).trim();
    if ((['<', '>', '=', 'is', '<=', '>=', '!=', '<>'].indexOf(operator) >= 0)) {
      return this.sql_name(operand) + " " + operator + " ";
    } else {
      throw new Error("Invalid predicate operator: " + operator);
    }
    if (operator === '%') {
      return this.sql_name(operand) + " LIKE ";
    }
    throw "Invalid operator " + operator;
  };
  // takes a predicate and populates it with values from the obj
  // instead of the template values on it
  SQL.prototype.populate_predicate = function(predicate, obj) {
    var _a, _b, _c, _d, cloned_predicate, key, operand, p, populated_predicates, predicates;
    predicates = [];
    populated_predicates = [];
    //allow the user to pass in a single predicates or multiple predicates
    !_.isArray(predicate) ? predicates.push(predicate) : (predicates = predicate);
    _b = predicates;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      predicate = _b[_a];
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
  SQL.prototype.sql_name = function(sql_name) {
    if (this.core_data_mode === true) {
      sql_name = sql_name.replace(/_/g, "");
      return ("Z" + (sql_name.toUpperCase()));
    }
    return sql_name;
  };
  SQL.prototype.convert_to_sqlite = function(value) {
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
  SQL.prototype.convert_from_sqlite = function(value, prototype_value) {
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

  root = (typeof window !== "undefined" && window !== null) ? window : exports;
  root.sqlite_sql = {};
  root.sqlite_sql.select = function(table, predicate, core_data_mode) {
    return new SQL(core_data_mode).select(table, predicate);
  };
  root.sqlite_sql.insert = function(table, obj, core_data_mode) {
    return new SQL(core_data_mode).insert(table, obj);
  };
  root.sqlite_sql.create_table = function(table, obj, core_data_mode) {
    return new SQL(core_data_mode).create_table(table, obj);
  };
  root.sqlite_sql.add_column = function(table, column, type, core_data_mode) {
    return new SQL(core_data_mode).add_column(table, column, type);
  };
  root.sqlite_sql.create_temp_table = function(table, obj, core_data_mode) {
    return new SQL(core_data_mode).create_temp_table(table, obj);
  };
  root.sqlite_sql.convert_to_sqlite = function(value, core_data_mode) {
    return new SQL(core_data_mode).convert_to_sqlite(value);
  };
  root.sqlite_sql.convert_from_sqlite = function(value, prototype_value, core_data_mode) {
    return new SQL(core_data_mode).convert_from_sqlite(value, prototype_value);
  };
  root.sqlite_sql.populate_predicate = function(predicate, obj, core_data_mode) {
    return new SQL(core_data_mode).populate_predicate(predicate, obj);
  };
})();
