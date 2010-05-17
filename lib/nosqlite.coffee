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
	# A nsl_sqlite_wrapper is an object that wraps
	# another SQLite driver with an HTML 5 web db interface
	sqlite_provider: require("webdb_sqlite")
	sys: require("sys")
	require("underscore")
	nsl_debug: sys.debug
else if window?
	# Running in the browser
	#Assume that all the required libs are bundled into a single file
	nsl_console: console
	if window.openDatabase?
		sqlite_provider: window
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
		}
		_.extend(@options, options) if options?

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
		@db: sqlite_provider.openDatabase name, version, displayName, estimatedSize, ->
			return callback() if callback?
		return this
		
	# the user can execute underlying transaction if they want to
	transaction: (start, failure, success) ->
		@db.transaction(start, failure, success)

	## Core Methods #################################

	# Finds an object or objects in the SQLite by running a query 
	# derived from the supplied predicate on the supplied table.  
	# 
	# Predicate syntax
	# --------------------------
	# The following is the supported predicate syntax:
	# 
	# As always, we will call you back when everything is ready!
	find: (table, predicate, the_callback) ->
		select: @sql.select(table, predicate)
		db: @db
		self: this
		callback: the_callback
		callback: predicate if _.isFunction(predicate)
		db.execute select.escaped, (error, results) ->
			if error? then return callback(error)
			callback(null, results)


	# Find the object in the database identified by the predicate
	# if it exists.	 Otherwise, saves it.
	# Use this method if you need to save stuff in SQLite if it's not already there.
	# This is useful for times you aren't sure if the object is already in the db.
	# and you don't have the rowid on the obj (othewise you could just do a save, which
	# does a insert or replace).
	# One e.g., syncing your db to some other data source.
	# As always with NoSQLite, if any SQL errors are thrown, such as the
	# the table not existing it will create them.
	# 
	#  Passing in an array
	# --------------------------
	# You can pass in an array of objects to this method as well.
	# NoSQLite will try to find and save the first object passed first	
	# in order to make sure the database isn't missing table or any columns.
	# If that works, NoSQLite will find or save the rest of them.
	# The supplied predicate will be used on each object, with the value
	# supplied from the objects in the array of course.
	# Just pass in a predicate template, NoSQLite will populate the predicate with
	# values from the corresponding object in the array.
	#
	#  Returns to your callback
	# --------------------------
	#
	# * an error if it occurs
	# * a simple string indicting success if object or objects didn't exist and were saved
	# * the object found or an array of objects found
	#
	# As always, we will call you back when everything is ready!
	find_or_save: (table, predicate, obj, callback) ->
		self: this

		first_obj: if _.isArray(obj) then obj[0] else obj
		the_rest: obj[1..obj.length] if _.isArray(obj)
		found: []
		num_saved: 0
		the_predicate = @sql.populate_predicate(predicate, first_obj)

		find_or_save_one: (table, predicate, obj, the_callback) ->
			self.find(table, predicate, (err, results) ->
				#debug "result of find are: " + inspect(results)
				if not results? or (results? and _.isArray(results) and results.length is 0)
					# The error could just be that the table doesn't exist in which 
					# save will take care of it.
					self.insert_object(table, obj, (err, result)->
						if not err? then num_saved += 1
						the_callback(err, result)
					)
				else if _.isArray(results) and results.length > 0
					found.push(results[0])
					the_callback(null, results[0])
			)

		find_or_save_one(table, the_predicate, first_obj, (err, result) ->
			callback(err) if err?			
			if the_rest?
				_.each(the_rest, (the_obj) ->
					the_predicate = @sql.populate_predicate(predicate, the_obj)
					find_or_save_one(table, the_predicate, the_obj, (err, result) ->
						if err? then callback(err)
						if the_obj is _.last(the_rest) then callback(err, num_saved)
					)
				)
			else callback(null, result)
		)


	# Error Handling
	# ------------------------
	#
	@NO_SUCH_TABLE: 0
	@NO_SUCH_COLUMN: 1
	@UNRECOGNIZED_ERROR: 99

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


		
String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

if window?
	NoSQLite.prototype.sql: sqlite_sql
	window.nosqlite: new NoSQLite()
else
	NoSQLite.prototype.sql: (require "./sqlite_sql").sqlite_sql
	exports.nosqlite: new NoSQLite()
	
# In a browser enviroment, the rest of the NoSQLite functions are 
# bundled below here in a single JS file