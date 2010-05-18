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
	else throw Error("Unsupported browser.  Does not support HTML5 Web API.")	
	
class NoSQLite

	# Creates a NoSQLite object
	# Pass in an optional Core Data compatible mode flag.
	# params:
	# * (optional) If set to `true` will create a core data compatible schema.
	constructor: (options) ->			
		@options = {
			core_data_mode: false
			safe_mode: false
			# whether to check if String columns are JSON
			# that start with nsl_json:  
			check_for_json: true
		}
		_.extend(@options, options) if options?
		# used for error handling
		@NO_SUCH_TABLE: 0
		@NO_SUCH_COLUMN: 1
		@UNRECOGNIZED_ERROR: 99

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
	# and will call JSON.parse on the items so your object comes back
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
							obj: _.clone(srs.rows.item(i))
							if self.options.check_for_json
								for key of obj
									continue unless _.isString(obj[key])
									if obj[key].startsWith "json: "
										val: obj[key].split("json: ")[1]
										obj[key]: JSON.parse(val)
							res.push(obj)
						callback(null, res)
					(transaction, err) ->
						if err? then return callback(err)
				)
		)

	# Stores an object or objects in SQLite. 
	# If the table doesn't exist, NoSQLite will create the table for you.
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
	save: (table, obj, callback) ->
		@table: table
		objs = obj if _.isArray(obj)
		objs = [obj] if not _.isArray(obj)

		self: this
		db: @db
		
		# An object that describes the current transaction
		# so that it can be restarted if need be
		tx: {
			table: table
			obj: obj
			callback: callback
		}

		#aggegrate_results
		res: {rowsAffected: 0} 
		
		db.transaction(
			(transaction) ->
				self.transaction: transaction
				# queue up sqls for each of the objs
				for obj in objs
					tx.current_obj: obj
					insert_sql: self.sql.insert(table, obj)
					transaction.executeSql(
						insert_sql.index_placeholder,
						insert_sql.bindings, 
						(transaction, srs) ->
							# maybe a post commit-hook
							res.rowsAffected += srs.rowsAffected
							res.insertId: srs.insertId
						(transaction, err) ->
							# we want the transaction error handler to be called
							# so we can try to fix the error
							tx.err: err
							return false
					)
			(transaction, err) ->
				self.tryToFix(tx)
			(transaction) ->
				# oddly browsers, don't call the method above
				# when an error occurs
				if tx.err? then self.tryToFix(tx)
				if callback? then callback(null, res)
		)


	# Helper methods
	
	# Error Handling
	# ------------------------



	# Tries to fix the current transaction automatically by
	# examing the SQLite error and doing the following:
	# creating the table if it doesn't exist
	# adding the column if it doesn't exist
	# 
	# If the error was fixed successfully retries the current
	# failed transaction.
	# Else notifies the callback
	tryToFix: (tx) ->
		return if not tx? or not tx.err?
		self: this
		err: if tx.err? and tx.err.message? then tx.err.message
		errobj: @parse_error(err)
		fix_sql: 
			switch errobj.code
				when @NO_SUCH_TABLE then @sql.create_table(tx.table, tx.current_obj).sql
				when @NO_SUCH_COLUMN then @sql.add_column(tx.table, errobj.column).sql
				else null
		if not fix_sql?
			return tx.callback(err) if tx.callback?
		else
			@db.transaction(
				(transaction) ->
					transaction.executeSql(fix_sql)
				(transaction, err) ->
					return tx.callback(err) if tx.callback?
				(transaction) ->
					# we fixed the problem, retry the tx
					self.save(tx.table, tx.obj, tx.callback)
			)

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