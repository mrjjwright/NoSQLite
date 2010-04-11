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
	constructor: (db_file, options, the_callback) ->
		sys.debug("creating instance of NoSQLite")
		@db_file = db_file
		@db: new sqlite.Database()
		@table_descriptions: []
		@options = {
			core_data_mode: false
			no_guid: false
		}

		if	_.isFunction(options)
			callback: options
		else 
			@options: _.extend(@options, options) if options?
			callback: the_callback
			
		#until we can get a truly async interface to sqlite
		#process.nextTick ->
			#callback(null, this)
		@db.open db_file, ->
			callback()
		
	# Finds an object or objects in the SQLite by running a query 
	# derived from the supplied predicate on the supplied table.  
	# 
	# Predicate syntax
	# --------------------------
	# The following is the supported predicate syntax:
	# 
	# As always, we will call you back when everything is ready!
	find: (table, predicate, the_callback) ->
		select: sql.select(table, predicate)
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
	# You can pass in an array of objects as well.	Each row will be inserted
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
						
		objs = obj if _.isArray(obj)
		objs = [obj] if not _.isArray(obj)
				
		self: this
		db: @db
		statement: {}

		flow.exec(
			->
				# start a transaction if we aren't in one
				if not tx_flag
					db.execute "begin transaction;", this
				else
					this()
			->
				# save the first one
				this_flow: this
				prepare_statement: ->
					insert_sql = sql.insert(table, objs[0], self.options.core_data_mode).name_placeholder
					#sys.debug insert_sql
					db.prepare insert_sql, (err, the_statement) ->
						if err?
							# This is NoSQLite, let's see if we can fix this!
							compensating_sql: self.compensating_sql(table, objs[0], err) 
							if compensating_sql?
								db.execute compensating_sql, null, (err) ->
									if err? then callback(err) if callback?
									else prepare_statement()
							else
								callback(err) if callback?
						else
							statement: the_statement
							this_flow(statement)
				prepare_statement()
			->
				# save the rest
				this_flow: this
				flow.serialForEach(objs, 
					(the_obj) ->
						this_serial: this
						statement.reset()
						self.bind_obj statement, the_obj
						statement.step ->
							this_serial()
					(error, res) ->
						if error? then throw error
					this_flow
				)
			->
				# commit the transaction
				if not tx_flag
					db.execute "commit;", this
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
			
		
	# binds all the keys in an object to a statement
	# by name
	bind_obj: (statement, obj) ->
		num_of_keys: Object.keys(obj).length
		i: 0
		for key of obj
			value: obj[key]
			if not _.isString(value) && not _.isNumber(value)
				value: JSON.stringify(value)
			#sys.debug "Binding ${value} to :${key} "
			statement.bind ":${key}", value
				
	# closes the underlying SQLite connection
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
	# A handy utility for doing a SQLite table data or schema migration.
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
	# for every other row in the temp table.  You can do data conversions in this callback
	# 
	# Finally, the temp table is deleted and the callback(err, res) function is called.
	# If any errors occur, callback(err) will be called.
	#
	# (Based roughly on the approach detailed in http://www.sqlite.org/faq.html, question 11)
	migrate_table: (table, convert_callback, callback) ->
		self: this
		row1: {}
		obj1: {}
		statement: {}
		statement1: {}
		db1: {}
		temp_table_name: "${table}_backup"
		sys.debug "Migrating table: ${table}"
		flow.exec(
			->
				self.db.execute "begin transaction", this
			->
				# create the temp table
				this_flow: this
				self.find table, {rowid: 2}, (err, res) ->
					row1: res[0]
					delete row1.rowid
					create_temp_table_sql: sql.create_temp_table(table, row1)
					self.db.execute create_temp_table_sql, this_flow
			->
				# dump all rows to the temp table 
				this_flow: this
				return_row_id: false
				select_sql: "select * from ${table}"
				dump_sql: "insert into ${temp_table_name} ${select_sql};"
				self.db.execute dump_sql, (err, res) ->
					if err? then return callback(err)
					this_flow()
			->
				#drop and recreate the table
				this_flow: this
				drop_table_sql: "drop table ${table}"
				self.db.execute drop_table_sql, (err, res) ->
					if err? then return callback(err)
					# we start with the first object to convert
					# so we get the new schema correct
					obj1: convert_callback(row1)
					create_table_sql: sql.create_table(table, obj1).sql
					self.db.execute create_table_sql, (err) ->
						if err? then callback(err)
						this_flow()
			->
				# commit and close the transaction
				self.db.execute "commit", this
			->
				# Prepare statements to 
				# Convert the rest of the rows and save to new table
				this_flow: this
				self.db.prepare "select * from ${temp_table_name} where rowid > 1",  (err, the_statement) ->
					if (err?) then return callback(err)
					statement: the_statement
					# open up another connection to the db
					db1: new sqlite.Database()
					db1.open self.db_file, ->
						db1.execute "begin transaction"
						db1.prepare sql.insert(table, obj1).name_placeholder, (err, the_statement) ->
							if (err?) then return callback(err)
							statement1: the_statement
							this_flow()
			->
				# Step through each row of the temp table 
				# , call the convert_callback
				# , and then in another sqlite connection insert the row
				# into the new table. 
				#  This way all rows are not read into memory
				this_flow: this
				migrate_row: ->
					statement.step (err, row) ->
						if not row? then return this_flow()
						converted_obj: convert_callback(row)
						statement1.reset()
						self.bind_obj statement1, converted_obj
						# step once to do the insert
						statement1.step -> 
							migrate_row()
				migrate_row()
			->
				# clean up 
				db1.execute "commit", -> statement.finalize -> statement1.finalize -> db1.close -> this
			->
				# drop the temp table and alert the callback
				self.db.execute "drop table ${temp_table_name}", (err, res) ->
					if err? then return callback(err)
					callback(null, "success") if callback?
		)
		
					

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
	