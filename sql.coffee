sys: require 'sys'
require "./underscore"
	
# A simple DSL for creating SQL statements frorm and for JS to SQLLite
class SQL
	constructor: (core_data_mode)->
		@values: []
		@values_escaped: []
		@columns: []
		@core_data_mode: core_data_mode
			
	select: (table, predicate) ->
		sql: "select rowid, * from " + @sql_name(table) 
		
		if (not predicate?) or _.isEmpty(predicate)
			@escaped: sql
			@placeholder: sql
			return this
			
		sql += " where"
		predicates: []
	
		# allow the user to pass in a single object or multiple objects
		if not _.isArray(predicate) then predicates.push(predicate) else predicates: predicate
		# generate the where clauses from what is passed in
		ands_escaped: []
		ands_index_placeholder: []
		ands_name_placeholder: []
		for predicate in predicates		
			for key of predicate 
				key_sql: @key_to_sql(key)
				@values_escaped.push(@convert_to_sqlite(predicate[key]))
				ands_escaped.push(key_sql + @convert_to_sqlite(predicate[key]))
				ands_index_placeholder.push(key_sql + "?")
				ands_name_placeholder.push(key_sql + ":${key}")
				@values.push(predicate[key])
			
		@escaped: sql + "(" + ands_escaped.join(" AND ") + ")"
		@index_placeholder: sql + "(" + ands_index_placeholder.join(" AND ") + ")"
		@name_placeholder: sql + "(" + ands_name_placeholder.join(" AND ") + ")"
		return this

	insert: (table, obj) ->
		sql: "insert or replace into " + @sql_name(table)
		question_marks: []
		names: []
		for key of obj
			@values.push(obj[key])
			@values_escaped.push(@convert_to_sqlite(obj[key]))
			@columns.push(@sql_name(key))
			question_marks.push("?")
			names.push(":${key}")
		columns_sep: @columns.join(",")
		@index_placeholder: sql + "(" + columns_sep + ") values ("  + question_marks.join(",") + ")"
		@name_placeholder: sql + "(" + columns_sep + ") values ("  + names.join(", ") + ")"
		@escaped: sql + "(" + columns_sep + ") values (" + @values_escaped.join(",") + ")"
		return this
	
	# returns SQLite based sql for creating a table based on an object	
	# uses JS info about each column to make some intelligent choices for a table
	# SQLite doesn't care too much what types we use in the sql "create table"
	# see http://www.sqlite.org/datatype3.html
	# it's more important when saving or reading JS Objects
	# Here is the simple mappings between JS objects and SQLite "type affinities" for sql:
	# JS Number -> SQLite NUMERIC
	# JS Date -> SQLite NUMERIC (can use Unix epoch)
	# all others use TEXT, when reading them in we try diff
	create_table: (table, obj) ->
		@sql: "create table " + @sql_name(table)
		@columns = []
		
		if @core_data_mode is true
			@columns.push("\"Z_PK\" INTEGER PRIMARY KEY AUTOINCREMENT")
			@columns.push("\"Z_ENT\" INTEGER")
			@columns.push("\"Z_OPT\" INTEGER")
			
		for key of obj
			if key is "rowid" then continue
			value: obj[key]
			type: if _.isNumber(value) or _.isDate(value) then "NUMERIC" else "TEXT"
			if key is "guid"
				type: "VARCHAR UNIQUE NOT NULL" 
			@columns.push("\"" + @sql_name(key) + "\" " + type)
		@sql += "(" + @columns.join(",") + ");"
		return this

	# create temp table sql.
	# We create it with the same number of cols as the old table
	# We don't care about the types
	create_temp_table: (table, obj)->
		# execute a pragma to get the number of cols in the old table
		keys: key for key of obj
		keys: _.reject keys, (key) -> key is "rowid"
		temp_cols: keys.join(",")
		return "create temporary table ${table}_backup(${temp_cols});"
	
	# returns add_column sql for SQLite
	# see http://www.sqlite.org/lang_altertable.html
	add_column: (table, column, type) ->
		@sql: "alter table '" + @sql_name(table) + "' add column '" + @sql_name(column) + "'"
		@sql: @sql + " " + type if type?
		return this
	
				
	key_to_sql: (key) ->
		p: key.indexOf(' ')
		return @sql_name(key) + " = " if p is -1
	
		operator: key.substr(p + 1)
		operand: key.substr(0, p)
	
		if (['<', '>', '=', '<=', '>=', '!=', '<>'].indexOf(operator) >= 0)
			return @sql_name(operand) + " " + operator + " ";
	
		if operator is '%'
			return @sql_name(operand) + " LIKE ";
	 
		throw "Invalid operator " + operator

	# takes a predicate and populates it with values from the obj
	# instead of the template values on it
	populate_predicate: (predicate, obj) ->
		predicates: []
		populated_predicates: []
		
		#allow the user to pass in a single predicates or multiple predicates
		if not _.isArray(predicate) then predicates.push(predicate) else predicates: predicate
		for predicate in predicates
			cloned_predicate: _.clone(predicate)
			for key of predicate
				# operands can come with operators, eg. 'col <'
				# or leave it off, implied "=" operator
				p: key.indexOf(' ')
				operand: if p is -1 then key else key.substr(0, p)
				cloned_predicate[key]: obj[operand]
			populated_predicates.push(cloned_predicate)
			
		return populated_predicates[0] if not _.isArray(predicate)
		return populated_predicates
	
	# Checks if in Core Data mode
	# converts the name to uppercase and prepends a Z if so
	# else just returns the name
	sql_name: (sql_name) ->
		if @core_data_mode is true
			sql_name: sql_name.replace(/_/g, "")
			return "Z${sql_name.toUpperCase()}"
		return sql_name
		
	convert_to_sqlite: (value) ->
		if not value? then return "NULL"
		# sqlite requires strings to be enclosed in single ticks and single ticks within
		# the string to be escaped with double single ticks
		# see http://www.sqlite.org/lang_expr.html
		if _.isNumber(value) is true then return value
		#if _.isDate(value) is true then return value.toString()
		if _.isString(value) is true
			str_value: value.replace(/\'/g, "''")
			return "'" + str_value + "'"
		return "'" + JSON.stringify(value).replace("'", "''") + "'"

	convert_from_sqlite: (value, prototype_value) ->
		return null if _.isString(value) and value is "NULL";
		#next we try to parse this as JSON
		try
			return JSON.parse(value)
		catch error
			return value
			
exports.SQL: SQL
exports.select: (table, predicate, core_data_mode) -> new SQL(core_data_mode).select(table, predicate)
exports.insert: (table, obj, core_data_mode) -> new SQL(core_data_mode).insert(table, obj)
exports.create_table: (table, obj, core_data_mode) -> new SQL(core_data_mode).create_table(table, obj)
exports.add_column: (table, column, type, core_data_mode) -> new SQL(core_data_mode).add_column(table, column, type)
exports.create_temp_table: (table, obj, core_data_mode) -> new SQL(core_data_mode).create_temp_table(table, obj)
exports.convert_to_sqlite: (value, core_data_mode) -> new SQL(core_data_mode).convert_to_sqlite(value)
exports.convert_from_sqlite: (value, prototype_value, core_data_mode) -> new SQL(core_data_mode).convert_from_sqlite(value, prototype_value)
exports.populate_predicate: (predicate, obj, core_data_mode) -> new SQL(core_data_mode).populate_predicate(predicate, obj)

