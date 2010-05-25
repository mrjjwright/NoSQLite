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
	webdb_provider: require("webdb_sqlite")
	sys: require("sys")
	require("underscore")
	nsl_debug: sys.debug
else if window?
	# Running in the browser
	#Assume that all the required libs are bundled into a single file
	nsl_console: console
	if window.openDatabase?
		webdb_provider: window
	else throw Error("Unsupported browser.  Does not support HTML5 Web DB API.")	
	
class NoSQLite

	# Creates a NoSQLite object
	# Pass in an optional Core Data compatible mode flag.
	# params:
	# * (optional) If set to `true` will create a core data compatible schema.
	constructor: (options) ->			
		@options = {
			core_data_mode: false
			# whether to check if String columns are JSON
			# that start with nsl_json:  
			check_for_json: true
			sync_mode: false
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
		@UNRECOGNIZED_ERROR: 99
		
		if @options.sync_mode
			if not window?
				@sync: new require("./nsl_sync").NSLSync(this)
			else
				@sync: new NSLSync(this)

	# Opens a database
	#
	# name: the name of a db, or the full path to a db file
	# options: (optional) the NoSQLite options
	# callback: (optional) a callback method to use if the call succeeded
	open: (name, options, callback) ->
		callback: if _.isFunction(options) then options
		@options = _.extend(@options, options) if options? and callback?
		@openDatabase(name, null, null, null, callback)
		return this
	
	# Opens the database 
	# Name to be the complete path to the db if it makes sense
	# Also providers can ignore the version attribute
	openDatabase: (name, version, displayName, estimatedSize, callback) ->
		@db: webdb_provider.openDatabase name, version, displayName, estimatedSize, ->
			return callback() if callback?
		return this
		
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
		select: @sql.select(table, predicate)
		self: this
		callback: the_callback
		callback: predicate if _.isFunction(predicate)
		self.db.transaction(
			(transaction) ->
				transaction.executeSql(
					select.index_placeholder, 
					select.bindings, 
					(transaction, srs) ->
						res: []
						for i in [0..srs.rows.length-1]
							obj: srs.rows.item(i)
							# apply any filters to the obj
							for filter in self.filters
								try
									obj: filter(obj)
								catch err1
									# ignore errors from filters
							res.push(obj)
						callback(null, res)
					(transaction, err) ->
						if err? then return callback(err)
				)
		)

	# Stores an object or objects in SQLite. 
	#
	# If the objects already exist in the database they will be updated because
	# NoSQLite issues an "insert or replace"
	#
	# One table is created for the object with the name supplied in param table.
	# One column is created for each top-level attribute of the object.
	# All columns are stored with SQLite type affinity "TEXT" except
	# dates and numeric Javascript types that are stored as "NUMERIC"
	# * Strings are stored as text
	# * Numbers are stored as numbers, don't worry about differences between integer types, floats, etc...
	# * Dates are stored as numbers, Unix epochs since 1970
	# * Booleans are stored as numbers, 1 for true or 0 for false
	# * Other objects (arrays, complex objects) are simply stored as JSON.stringify text
	# You can pass in an array of objects as well.	Each row will be inserted
	#
	# As always, we'll call you back when everything is ready!
	save: (obj_desc, callback) ->
		obj_descs = obj_desc if _.isArray(obj_desc)
		obj_descs = [obj_desc] if not _.isArray(obj_desc)
		if not callback?
			callback: save_hook
			save_hook: undefined
		
		if save_hook?
			@save_hooks.push(save_hook)

		self: this
		db: @db
		
		#aggegrate_results
		res: {rowsAffected: 0} 
		# a counter obj that keeps track of where we are at in proccesing 
		current_err: undefined
		current_obj_desc: {}
		save_args: []
		save_args.push(obj_desc)
		save_args.push(save_hook)
		save_args.push(callback)
		
		db.transaction(
			(transaction) ->
				self.transaction: transaction
				# queue up sqls for each of the objs
				# We build obj_descs for each obj to insert
				# Each obj description is a special obj where each key
				# is the name of a table in which to save the obj
				# and the value is the obj
				insert_objs: (obj_descs, hooks) ->
					for obj_desc in obj_descs
						obj_counter: 0
						current_obj_desc: obj_desc
						insert_sql: self.sql.insert(obj_desc.table, obj_desc.obj)
						transaction.executeSql(
							insert_sql.index_placeholder,
							insert_sql.bindings, 
							(transaction, srs) ->
								obj_counter += 1
								res.rowsAffected += srs.rowsAffected
								res.insertId: srs.insertId
								# insert any other objects
							  	# each hook can return one or more obj_desc objects
								if hooks?
									for hook in hooks
										insert_objs(hook(srs.insertId, obj_desc))
							(transaction, err) ->
								# we want the transaction error handler to be called
								# so we can try to fix the error
								current_err: err
								current_obj_desc: obj_descs[obj_counter]
								return false
						)
				insert_objs(obj_descs, self.save_hooks)					
			(transaction, err) ->
				self.fixSave(err, current_obj_desc, callback, save_args)
			(transaction) ->
				# oddly browsers, don't call the method above
				# when an error occurs
				if current_err? then self.fixSave(current_err, current_obj_desc, callback, save_args)
				if callback? then callback(null, res)
		)


	# Tries to fix the current save automatically by
	# examing the SQLite error and doing the following:
	# creating the table if it doesn't exist
	# adding the column if it doesn't exist
	# 
	# If the error was fixed successfully retries the current
	# failed transaction.
	# Else notifies the callback
	fixSave: (err, obj_desc, callback, save_args) ->
		return if not err?
		self: this
		err: if err? and err.message? then err.message
		errobj: @parse_error(err)
		fix_sql: 
			switch errobj.code
				when @NO_SUCH_TABLE then @sql.create_table(errobj.table, obj_desc.obj).sql
				when @NO_SUCH_COLUMN then @sql.add_column(obj_desc.table, errobj.column).sql
				else null
		if not fix_sql?
			return callback(err) if callback?
		else
			@db.transaction(
				(transaction) ->
					transaction.executeSql(fix_sql)
				(transaction, err) ->
					return callback(err) if callback?
				(transaction) ->
					# we fixed the problem, retry the tx
					self.save.apply(self, save_args)
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
		else
			errobj.code = @UNRECOGNIZED_ERROR
		return errobj
		
String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

String.prototype.startsWith: (str) ->
    return this.indexOf(str) is 0

if window?
	NoSQLite.prototype.sql: sqlite_sql
	window.nosqlite: new NoSQLite()
else
	NoSQLite.prototype.sql: (require "./sqlite_sql").sqlite_sql
	exports.nosqlite: new NoSQLite()
	
# In a browser enviroment, the rest of the NoSQLite functions are 
# bundled below here in a single JS file