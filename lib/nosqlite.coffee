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
	nsl_sqlite_wrapper: require("./nsl_node_sqlite").nsl_node_sqlite
	sys: require("sys")
	require("underscore")
	nsl_debug: sys.debug
else if window?
	# Running in the browser
	#Assume that all the required libs are bundled into a single file
	nsl_console: console
	if window.openDatabase? and not nsl_cocoa?
		nsl_sqlite_wrapper: window
	else if nsl_cocoa?
		# Running inside a hidden webkit control inside a Cocoa app	
		nsl_sqlite_wrapper: nsl_cocoa_sqli
	else throw Error("Unsupported browser.  Does not support HTML5 Web API.")	
	
class NoSQLite

	# Pass in a path to a sqlite file
	# Pass in an optional Core Data compatible mode flag.
	# params:
	# * path to db.
	# * (optional) If set to `true` will create a core data compatible schema.
	constructor: () ->			
		@table_descriptions: []
		@options = {
			core_data_mode: false
			safe_mode: true
		}

	# Opens a database
	#
	# name: the name of a db, or the full path to a db file
	# options: (optional) the NoSQLite options
	# callback: (optional) a callback method to use if the call succeeded
	open: (name, options, callback) ->
		@options = _.extend(@options, options) if options?
		@openDatabase(name, null, null, null, callback)
	
	# Opens the database 
	# Name to be the complete path to the db if it makes sense
	# Also providers can ignore the version attribute
	openDatabase: (name, version, displayName, estimatedSize, callback) ->
		try
			@db: nsl_sqlite_wrapper.openDatabase(name, version, displayName, estimatedSize, callback)
		catch err
			handleError(err)

	# Sets a function to call onError
	onError: (handler) ->
		@errorHandler: handler

		handleError: (err) ->
			if errorHandler? then errorHandler(err)

	# closes the underlying SQLite connection
	close: ->
		@db.close ->
		


String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

root: if exports? then exports else window
root.nosqlite: new NoSQLite()
root.NoSQLite: NoSQLite

# The rest of the functions on NoSQLite are 
# attached to the NoSQLite prototype after
# the below CommonJS code executes
if require?
	require "./nsl_sql"	
	require "./nsl_core"

# In a browser enviroment, the rest of the NoSQLite functions are 
# bundled below here in a single JS file