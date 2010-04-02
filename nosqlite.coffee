require "./underscore"
sql: require "./sql"
require "./Math.uuid"
sys: require "sys"
flow: require "./flow"
sqlite: require "./sqlite"

# NoSQLite - SQLite for Javascript
# ---------------------------------
# 
# A library to make it as easy as possible to store and retrieve JS objects
# from SQLite. Zero-configuration!  
# Attempts to store JS objects as intelligently as possible in SQLite.
class NoSQLite

	# Pass in a path to a sqlite file
	# Pass in an optional Core Data compatible mode flag.
	# params:
	# * path to db.
	# * (optional) If set to `true` will create a core data compatible schema.
	constructor: (db_file, options, callback) ->
		sys.debug("creating instance of NoSQLite")
		
		@db: new sqlite.Database()
		@table_descriptions: []
		@options = {
			core_data_mode: false
			no_guid: false
		}

		if  _.isFunction(options)
			the_callback: options
		else 
			@options: _.extend(@options, options) if options?
			the_callback: callback
		#go ahead and open the db
		@db.open db_file, ->
			the_callback()
		
		
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
		@hash_flag: true
		
		try
			db.query(select.escaped, (res) ->
				callback(null, res)
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

				

	# Stores an object or objects in SQLite. 
	# If the table doesn't exist, NoSQLite will create the table for you.
	#
	# If the objects already exist in the database NoSQL they will be updated because
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
	# You can pass in an array of objects as well.  Each row will be inserted
	#
	# As always, we'll call you back when everything is ready!
	save: (table, obj, in_transaction, the_callback) ->
	
		#augment object with guid unless options say not to
		if @options.no_guid is false 
			if not _.isArray(obj)
				obj.guid: Math.uuidFast() 
			else for o in obj
				o.guid: Math.uuidFast()
		
		tx_flag: false
		callback: in_transaction
		if _.isBoolean(in_transaction)
			tx_flag: in_transaction
			callback: the_callback
			
		
		inserts: []
		inserts: sql.insert(table, table_obj, @options.core_data_mode) for table_obj in obj if _.isArray(obj)
		inserts.push(sql.insert(table, obj, @options.core_data_mode)) if not _.isArray(obj)
		the_obj: if _.isArray(obj) then obj[0] else obj
		self: this
		db: @db

		flow.exec(
			->
				# start a transaction if we aren't in one
				if not tx_flag
					db.query "begin transaction", this
				else
					this()
			->
				# save the first one
				self_this: this
				try_first_one: ->
					db.query inserts[0].escaped, null, (err) ->
						if err?
							# This is NoSQLite, let's see if we can fix this!
							compensating_sql: self.compensating_sql(table, the_obj, err) 
							if compensating_sql?
								db.query compensating_sql, null, (err) ->
									if err? then callback(err) if callback?
									else try_first_one()
							else
								callback(err) if callback?
						else 
							self_this()
				try_first_one()
			->
				# save the rest
				self_this: this
				do_insert: (i) ->
					db.query inserts[i].escaped, (err) ->
						if err?
							callback(err)
							return
						if i-- then do_insert(i)
						else self_this()
				if inserts.length > 1 then do_insert(inserts.length-1)
				else this()
			->
				# commit the transaction
				if not tx_flag
					db.query "commit", this
				else
					this()
			->
				# callback to the user
				callback(null, "success") if callback?
		)
		
	
	compensating_sql: (table, the_obj, the_err) ->
		err: if the_err? and the_err.message? then the_err.message else the_err
		@parse_error(err)
		return compensating_sql: switch @errobj.code
				when NO_SUCH_TABLE then sql.create_table(table, the_obj, @options.core_data_mode).sql
				when NO_SUCH_COLUMN then sql.add_column(table, @errobj.column, null, @options.core_data_mode).sql
				else null
			
					
	# closes any underlying SQLite connection
	# currently, this means closes the underlying SQLite db process
	close: ->
		@db.close(->
		)
	
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

	# Migrations
	# -------------------------------------
	# A handy utility for doing a SQLite table schema migration.
	# 
	# If something goes wrong here at the wrong time, 
	# not that it will, I know you have a backup. :)
	# 
	# First creates a temporary table and dumps all the rows from the old table.
	# The old table is then dropped.
	# 
	# The convert_callback(old_obj) will then be called for the first row in 
	# in the temp table.  The object returned by convert_callback 
	# should implicitly describe (using nosqlite conventions, detailed in docs for save) 
	# the new schema that will be used to create the new table.
	# The first row will be inserted and convert_callback will be called for 
	# for every other row in the temp table.
	# 
	# Finally, the temp table is deleted and the callback(err, res) function is called.
	# If any errors occur, callback(err) will be called.
	#
	# (Based roughly on the approach detailed in http://www.sqlite.org/faq.html, question 11)
	migrate_table: (table, convert_callback, callback) ->
		self: this
		row1: {}
		flow.exec(
			->		
				#create the temp table
				self.find table, {rowid: 1}, (err, res) ->
					row1: res[0]
					create_temp_table(row1, this)
			->
				this_flow: this
				#convert and save the first row
				new_obj: convert_callback(row1)
				self.save table, new_obj, (err, res) ->
					if err? then callback(err)
					this_flow()
			->
				this_flow()
				#convert the rest of the rows
				self.find table, {'rowid >': 1}, (err, res) ->
					for row in res
						converted_obj: convert_callback(row)
						self.save table, converted_obj,  (err, res) ->
							if err? then callback(err)
							this_flow()
			->
				callback(null, "success") if callback?
		)
		# create the temp table.
		# We create it with the same number of cols as the old table
		# We don't care about the types
		create_temp_table: (obj, callback)->
			# execute a pragma to get the number of cols in the old table
			temp_cols: obj.keys.join(",")
			temp_table_sql: "create temporary table ${table}_backup(${temp_cols});"
			# this doesn't execute async (yet)
			db.query(temp_table_sql)
			callback()
			

	# Web API
	# --------------------------------------
	write_res: (response, err, result) ->
		if err?
			response.writeHead(500, {"Content-Type": "text/plain"})
			response.write(err)
		else
			response.writeHead(200, {"Content-Type": "text/plain"})
			response.write(JSON.stringify(result))											
		response.close();

	# Starts a webserver on the supplied port to serve http requests
	# for the instance's associated database.
	# If NoSQLite has already started a webserver on that port
	# this method returns silently.	
	listen: (port, host) ->
		host: "127.0.0.1" if not host?
		port: 5000 if not port?
		http: require "http" if not http?
		self: this	
		server: http.createServer( (request, response) ->
			body: ""
			url: require("url").parse(request.url, true)
			if not url.query?  or not url.query.method?
				response.writeHead(500, {"Content-Type": "text/plain"})
				response.write("Must supply method param")
				response.close();
				return
			table: url.query.table
			# Parse the url to see what the user wants to do
			request.setBodyEncoding('utf8');
			request.addListener "data", (data) ->
				body += data
			request.addListener "end", ->
				switch url.query.method
					when "save" 
						obj: JSON.parse(body)
						self.save(table, obj, (err, result) ->
							self.write_res(response, err, result)
						 )
					when "find" 
						predicate: JSON.parse(body)
						self.find(table, predicate, (err, result) ->
							if result?
								self.write_res(response, err, result)
						 )
					when "find_or_save" 
						args: JSON.parse(body)
						self.find_or_save(table, args[0], args[1], (err, result) ->
							self.write_res(response, err, result)
						 )
					else
						response.writeHead(500, {"Content-Type": "text/plain"})
						response.write("Unrecognized method: ${url.query.method}")
						response.close();
		 )
		server.listen(port, host)
		return server	

	
	
NO_SUCH_TABLE: 0
NO_SUCH_COLUMN: 1
UNRECOGNIZED_ERROR: 99

String.prototype.trim: ->
  return this.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1")

# connect to NoSQLite this way.
exports.connect: (db, options, callback) ->
	return new NoSQLite(db, options, callback)
	