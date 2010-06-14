# NoSQLite - SQLite for Javascript
# (c) 2010 John J. Wright
# NoSQLite is freely distributable under the terms of the MIT license.
#
# For all details and documentation:
# http://github.com/mrjjwright
# 
# -------------------------------------------------------------------
# A library to make it as easy as possible to store and retrieve JS objects
# from SQLite. Zero-configuration!	
# Attempts to work with JS objects as intelligently as possible in SQLite.

if not window? and require?
	# Running in a CommonJS environment like Node.js
	# A webdb_provider is an object that wraps
	# another SQLite driver with an HTML 5 web db interface
	require.paths.unshift "vendor"
	webdb_provider: require("webdb_sqlite")
	sys: require("sys")
	require("underscore")
	nsl_debug: sys.debug
	flow: require("flow")
else if window?
	# Running in the browser
	#Assume that all the required libs are bundled into a single file
	nsl_console: console
	if window.openDatabase?
		webdb_provider: window
	else throw Error("Unsupported browser.  Does not support HTML5 Web DB API.")	
	
class NSLCore

	# Creates a NoSQLite object
	# Pass in an optional Core Data compatible mode flag.
	# params:
	# * (optional) If set to `true` will create a core data compatible schema.
	constructor: (db_name, options, callback) ->			
		@options = {
			core_data_mode: false
			# whether to check if String columns are JSON
			# that start with nsl_json:  
			check_for_json: true
		}
		
		# setup some of the default filters
		@filters: []
		@filters.push(@json_text_to_obj)
		@pre_save_hooks: []
		@post_save_hooks: []
		
		_.extend(@options, options) if options?
		# used for error handling
		@NO_SUCH_TABLE: 0
		@NO_SUCH_COLUMN: 1
		@CONSTRAINT_FAILED: 2
		@UNRECOGNIZED_ERROR: 99
		self: this
		self.db: webdb_provider.openDatabase db_name, '1.0', 'Offline document storage', 5*1024*1024, (err, db) ->
			if err? then throw err
			sys.debug("Database created")
			callback(null, self)
		return this
	
	create_schema: (obj_descs, callback) ->
		self: this
		if _.isFunction(obj_descs)
			callback: obj_descs
		else
			obj_descs: _.flatten([obj_descs, {table: "last_insert", rowid_name: "row_id", objs: [{row_id: null}]}])

		self.create_table obj_descs, (err) ->
			return callback(err) if err?
			self.execute "insert into last_insert values (0)", (err, res) ->
				return callback(null, self) if callback?
					
	# A poss through to the underly db transaction
	# in case the user wants to execute their own transactions
	transaction: (start, failure, success) ->
		@db.transaction(start, failure, success)
			
	## Core Methods #################################

	# Finds an object or objects in the db 
	#  
	# table is the table to search against
	# predicate is optional - if missing will return all rows 
	# 
	# Predicate syntax
	# --------------------------
	# {col: "foo"} -> where col = "foo"
	# {"col <": 3} -> where col < 3
	# Supported operators are sqlite where operators
	# {col1: "foo", "col >=": 12} -> where col1="foo" and col1 >= 12
	# 
	# If the returned value is a string and starts with "json:"
	# then NoSQLite assumes it wrote out serialized JSON for a complex object
	# and will call JSON.parse on the attribute so your object comes back
	# the same way you put it in.  You can turn this off by setting
	# the nosqlite option: nosqlite.options.check_for_json = false
	#
	# As always, we will call you back when everything is ready!
	find: (table, predicate, the_callback) ->
		self: this
		if table.startsWith("select ") or table.startsWith("SELECT ")
			sql: table
			bindings: []
		else 
			select: @sql.select(table, predicate)
			sql: select.index_placeholder
			bindings: select.bindings
		callback: the_callback
		callback: predicate if _.isFunction(predicate)
		self.db.transaction(
			(transaction) ->
				transaction.executeSql(
					sql
					bindings
					(transaction, srs) ->
						res: []
						for i in [0..srs.rows.length-1]
							obj: srs.rows.item(i)
							continue if not obj?
							# apply any filters to the obj
							for filter in self.filters
								try
									obj: filter(obj)
								catch err1
									# ignore errors from filters
							res.push(obj)
						res: undefined if res.length is 0
						callback(null, res)
					(transaction, err) ->
						if err? then return callback(err)
				)
		)
	
	# executes table create statements for the obj descs 
	create_table: (obj_desc, callback) ->
		obj_descs: if _.isArray(obj_desc) then obj_desc else [obj_desc]
		
		self: this
		self.db.transaction(
			(transaction) ->
				flow.serialForEach(
					obj_descs
					(obj_desc) ->
						create_table_sql: self.sql.create_table(obj_desc.table, obj_desc.objs[0], obj_desc.rowid_name).sql
						transaction.executeSql(
							create_table_sql,
							null
							this
							(transaction, err) ->
								return false
						)
					null
					null
				)
			(err) ->
				return callback(err) if callback?
			(transaction) ->
				return callback() if callback?
		)
		
	# Saves an object or objects in SQLite.
	# A convenience method that wraps save_objs
	save: (table, obj, callback) ->
		obj_desc: {
			table: table
			objs: _.flatten([obj]) 
		}
		@save_objs(obj_desc, callback)
	
	
	# Stores an object or objects in SQLite described by the descriptor.
	# 
	# The object descriptor should be an object, or array of objects
	# where each object has followig attributes:
	# table - the table to insert the obj
	# obj - a single obj or array of objects to insert into the table
	# after (optional) - a function to call after each row has been inserted
	#
	# One table is created for the object with the name supplied in param table.
	# The create table statement is generated as follows:
	# * Strings are stored as text
	# * Numbers are stored as numbers, don't worry about differences between integer types, floats, etc...
	# * Dates are stored ISO 8601 date strings
	# * Other objects (arrays, complex objects) are simply stored as JSON.stringify text
	#
	# As always, we'll call you back when everything is ready!
	save_objs: (obj_desc, callback) ->
		# we accept an array or a single obj_desc
		obj_descs: if _.isArray(obj_desc) then obj_desc else [obj_desc]
		
		self: this
		db: @db
		
		#aggegrate_results
		res: {rowsAffected: 0} 
		
		# a counter obj that keeps track of where we are in proccesing 
		current_err: undefined
		save_args: []
		save_args.push(obj_desc)
		save_args.push(callback)
		save_func: arguments.callee
		insert_options: {
			rowid_sql: "select row_id from last_insert"
		}
		db.transaction(
			(transaction) ->
				self.transaction: transaction
				# queue up sqls for each of the objs
				# We build obj_descs for each obj to insert
				# Each obj description is a special obj where each key
				# is the name of a table in which to save the obj
				# and the value is the obj
				transactionSuccess: (transaction, srs) ->
					res.rowsAffected += srs.rowsAffected
					res.insertId: srs.insertId
				transactionFailure: (transaction, err) ->
					# we want the transaction error handler to be called
					# so we can try to fix the error
					errobj: self.parse_error(err.message)
					if errobj.code is self.CONSTRAINT_FAILED
						if obj_descs[0].ignore_constraint_errors? is true
							return false
					current_err: err
					return true

				for obj_desc in obj_descs
					if not obj_desc.objs? or not _.isArray(obj_desc.objs)
						throw Error("Each obj_desc should have an objs array on it")
					if obj_desc.ignore_constraint_errors is true
						insert_options.ignore: true
					else
						insert_options.ignore: false
						
					for obj in obj_desc.objs
						insert_sql: self.sql.insert(obj_desc.table, obj, insert_options)
						transaction.executeSql(
							insert_sql.index_placeholder
							insert_sql.bindings
							transactionSuccess
							transactionFailure
						)
						# child objects we insert using the last_row table
						# this table is updated with the rowid of the last insert
						# which we can use for all child inserts
						transaction.executeSql(
							"update last_insert set row_id = last_insert_rowid()"
						)
						if obj.nsl_children?
							for child_desc in obj.nsl_children
								if not child_desc.fk?
									throw new Error("Must have fk on child obj")
								insert_options.rowid_name: child_desc.fk
								for child_obj in child_desc.objs
									child_sql: self.sql.insert(child_desc.table, child_obj, insert_options)
									transaction.executeSql(
										child_sql.index_placeholder
										child_sql.bindings
										transactionSuccess
										transactionFailure
									)
							
			(err) ->
				return callback(err)
			(transaction) ->
				# oddly browsers, don't call the method above
				# when an error occurs
				if current_err? then return callback(current_err)
				if callback? then return callback(null, res)
		)


	# Tries to fix the current save automatically by
	# examing the SQLite error and doing the following:
	# creating the table if it doesn't exist
	# adding the column if it doesn't exist
	# 
	# If the error was fixed successfully retries the current
	# failed transaction by calling fix_back with the save_args
	# Else notifies the callback
	fix_save: (err, obj_desc, obj, callback, fixback, save_args) ->
		return if not err?
		self: this
		err: if err? and err.message? then err.message
		errobj: @parse_error(err)
		fix_sql: 
			switch errobj.code
				when @NO_SUCH_TABLE then @sql.create_table(obj_desc.table, obj, obj_desc.rowid_name).sql
				when @NO_SUCH_COLUMN then @sql.add_column(obj_desc.table, errobj.column).sql
				else null
		
		if not fix_sql?
			return callback(err) if callback?
		else
			@db.transaction(
				(transaction) ->
					transaction.executeSql(
						fix_sql,
						null,
						null,
						(transaction, err) ->
							throw err if err?
					)
				(transaction, err) ->
					return callback(err) if callback?
				(transaction) ->
					# we fixed the problem, retry the tx
					if fixback?
						fixback.apply(self, save_args)
					else if callback?
						callback(err)
					else
						throw err
			)

	# Executes a SQL statement and returns the result
	# 
	# This is just a convenience function
	execute: (sql, callback) ->
		srs: {}
		@db.transaction(
			(transaction) ->
				transaction.executeSql(
					sql
					null
					(transaction, the_srs) ->
						srs: the_srs
					(transaction, err) ->
						callback(err) if err?
						return true
				)
			null
			(transaction) ->
				return callback(null, srs) if callback?
		)
		
	# Built-in filters
	
	# go through a key of an object and checks for String
	# attributes that start with "json: " and calls 
	# JSON.parse on them
	json_text_to_obj: (obj) ->
		for key of obj
			continue unless _.isString(obj[key])
			if obj[key].startsWith "json: "
				val: obj[key].split("json: ")[1]
				obj[key]: JSON.parse(val)
		return obj
	  
	
	
	# Error Handling
	# ------------------------


	# Parses error into an internal error code		
	parse_error: (err) ->
		errobj: {}
		if err.indexOf("no such table") != -1
			errobj.code = @NO_SUCH_TABLE
			errobj.table = err.split("table: ")[1]
		else if err.indexOf("no column named ") != -1
			errobj.code = @NO_SUCH_COLUMN
			errobj.column = err.split("no column named ")[1].trim()
		else if err.indexOf("constraint failed") != -1
			errobj.code = @CONSTRAINT_FAILED
		else
			errobj.code = @UNRECOGNIZED_ERROR
		return errobj
		
String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

String.prototype.startsWith: (str) ->
    return this.indexOf(str) is 0


nosqlite: {
	
	# Opens a database
	#
	# name: the name of a db, or the full path to a db file
	# options: (optional) the NoSQLite options
	# callback: (optional) a callback method to use if the call succeeded
	open: (name, options, callback) ->
		callback: if _.isFunction(options) then options else callback
		if options?.sync_mode? is true
			if not window?
				NSLSync: require("./nsl_sync").NSLSync
			else
				NSLSync: window.NSLSync
			nsl: new NSLSync(name, options, callback)
		else
			nsl: new NSLCore(name, options, callback)
		
		return nsl
		
}
		
if window?
	NSLCore.prototype.sql: sqlite_sql
	window.nosqlite: nosqlite
	window.NSLCore: NSLCore
else
	NSLCore.prototype.sql: (require "./sqlite_sql").sqlite_sql
	exports.nosqlite: nosqlite
	exports.NSLCore: NSLCore
	
# In a browser enviroment, the rest of the NoSQLite functions are 
# bundled below here in a single JS file