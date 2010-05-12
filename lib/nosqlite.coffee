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
	nsl_open_db: require("./nsl_node_sqlite").openDatabase
	nsl_debug: require("sys").debug
else if window?
	# Running in the browser
	#Assume that all the required libs are bundled into a single file
	nsl_console: console
	if window.openDatabase? and not nsl_cocoa?
		nsl_open_db: window.openDatabase
	else if nsl_cocoa?
		# Running inside a hidden webkit control inside a Cocoa app	
		nsl_open_db: nsl_cocoa.openDatabase
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

	openDatabase: (name, version, displayName, estimatedSize, callback) ->
		@db: nsl_open_db.apply(root, arguments)
	
	# closes the underlying SQLite connection
	close: ->
		@db.close ->


String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

root: if exports? then exports else window
root.nosqlite: new NoSQLite()
root.NoSQLite: NoSQLite

if require?
	require "./nsl_sql"	
	require "./nsl_core"
