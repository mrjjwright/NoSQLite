require "underscore"
sql: require "./sql"

# NoSQLite - SQLite for Javascript
# ---------------------------------
# 
# A library to make it as easy as possible to store and retrieve JS objects
# from SQLite. Zero-configuration!  
# Attempts to store JS objects as intelligently as possible in SQLite.
class NoSQLite

	# Pass in a valid HTML 5 compatible SQLite object
	# Pass in an optional Core Data compatible mode flag.
	# params:
	# * A HTML 5 compatible JS object.
	# * (optional) If set to `true` will create a core data compatible schema.
	constructor: (db, core_data_mode) ->
		sys.debug("creating instance of NoSQLite")
		
		@db: db 
		@table_descriptions: []
		@core_data_mode=core_data_mode
		
	# Finds an object or objects in the SQLite by running a query 
	# derived from the supplied predicate on the supplied table.  
	# 
	# Predicate syntax
	# --------------------------
	# The following is the supported predicate syntax:
	# 
	# As always, we will call you back when everything is ready!
	find: (table, predicate, callback) ->
		select: sql.select(table, predicate)
		db: @db
		self: this
		table: table
		predicate: predicate
		
		try
			db.query(select.escaped, (select) ->
				#sys.puts(sys.inspect(select))
				callback(null, select)
			)
		catch the_err
			debug "error on find: " + the_err
			err: if the_err.message? then the_err.message else the_err
			self.parse_error(err)
			switch self.errobj.code
				when self.NO_SUCH_TABLE then callback("NoSQLite doesn't know about this table yet.  Either call save or create_table.")
				when self.NO_SUCH_COLUMN then callback("NoSQLite can create this column for you if you call create_table with an object with that property")
				else callback(err)
			
	# Find the object in the database identified by the predicate
	# if it exists.  Otherwise, saves it.
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
		the_predicate = sql.populate_predicate(predicate, first_obj)
		
		find_or_save_one: (table, predicate, obj, the_callback) ->
			self.find(table, predicate, (err, results) ->
				#debug "result of find are: " + inspect(results)
				if not results? or (results? and _.isArray(results) and results.length is 0)
					# The error could just be that the table doesn't exist in which 
					# save will take care of it.
					self.save(table, obj, (err, result)->
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
					the_predicate = sql.populate_predicate(predicate, the_obj)
					find_or_save_one(table, the_predicate, the_obj, (err, result) ->
						if err? then callback(err)
						if the_obj is _.last(the_rest) then callback(err, num_saved)
					)
				)
			else callback(null, result)
		)

				

	# Stores an object or objects in SQLite even if the table doesn't exist.
	# NoSQLite will create the table for you.
	# One table is created for the object with the name supplied in param table.
	# One column is created for each top-level attribute of the object.
	# All columns are stored with SQLite type affinity "TEXT" except
	# dates and numeric Javascript types that are stored as "NUMERIC"
	# * Strings are stored as text
	# * Numbers are stored as numbers, don't worry about differences between integer types, floats, etc...
	# * Dates are stored as numbers, Unix epochs since 1970
	# * Booleans are stored as numbers, 1 for true or 0 for false
	# * Other objects (arrays, complex objects) are simply stored as JSON.stringify text
	# You can pass in an array of objects as well.  If over a certain limit,
	# NoSQLite will batch the inserts together using a SQLite import command
	# which is really fast.
	#
	# If the objects already exist in the database NoSQL will overwrite them for you with an update
	# As always, we'll call you back when everything is ready!
	save: (table, obj, callback) ->
		inserts: []
		inserts: sql.insert(table, table_obj, @core_data_mode) for table_obj in obj if _.isArray(obj)
		inserts.push(sql.insert(table, obj, @core_data_mode)) if not _.isArray(obj)
		the_obj: if _.isArray(obj) then obj[0] else obj
		self: this
		db: @db
		array_of_inserts: [inserts[0]]

		first_one: (tx)->
			try
				if tx?
					db.query(inserts[0].escaped)
				if not tx?
					db.transaction(insert_into_db, null, process_rest)
			catch error
				errback(tx, error) if error?
				
		process_rest: (tx) ->
			if inserts.length > 1
				#process the rest
				array_of_inserts: inserts[1..inserts.length]
				db.transaction(insert_into_db, null, (res) ->
					callback(null, "success") if callback?
				)
			else
				callback(null, "success") if callback?
		

		errback: (tx, the_err) ->
			err: if the_err? and the_err.message? then the_err.message else the_err
			
			debug "received error: " + err
			self.parse_error(err)
			compensating_sql: switch self.errobj.code
					when NO_SUCH_TABLE then sql.create_table(table, the_obj, self.core_data_mode).sql
					when NO_SUCH_COLUMN then sql.add_column(table, self.errobj.column, null, self.core_data_mode).sql
					else null
			
			sys.debug "compensating sql: " + compensating_sql
			
			if compensating_sql?
				db.query(compensating_sql)
				first_one(tx)
			else callback(err) if callback?
			debug "exiting errback"
				
		insert_into_db: (tx) ->
			for insert in array_of_inserts
				try
					tx.executeSql(insert.escaped);
				catch error2
					errback(tx, error2)
			
		# try the first insert first to see if there any errors
		# then the rest
		# this all happens within one sql transaction to make it really fast
		first_one()


			
	# closes any underlying SQLite connection
	# currently, this means closes the underlying SQLite db process
	close: ->
		@db.close()
	
	# Error Handling
	# ------------------------
	#
	handle_error: (err) ->
		this.parse_error(err)
		switch @errobj.code
			when NO_SUCH_TABLE then this.create_table()

	parse_error: (err) ->
		@errobj: {}
		if err.indexOf("no such table") != -1
			@errobj.code = NO_SUCH_TABLE
			@errobj.table = err.split("table: ")[1]
		else if err.indexOf("no column named ") != -1
			@errobj.code = NO_SUCH_COLUMN
			@errobj.column = err.split("no column named ")[1].trim()
		else
			@errobj.code = UNRECOGNIZED_ERROR
			
	
NO_SUCH_TABLE: 0
NO_SUCH_COLUMN: 1
UNRECOGNIZED_ERROR: 99

String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

# connect to NoSQLite this way.
exports.connect: (db, core_data_mode) ->
	return new NoSQLite(db, core_data_mode)
	
	
	
