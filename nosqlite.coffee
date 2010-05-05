require "./underscore"
sql: require "./sql"
sys: require "sys"
flow: require "./flow"
sqlite: require "./sqlite"
hashlib: require "./hashlib"
http: require "http"

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
			safe_mode: true
		}

		if	_.isFunction(options)
			callback: options
		else 
			@options: _.extend(@options, options) if options?
			callback: the_callback
			
		#until we can get a truly async interface to sqlite
		#process.nextTick ->
			#callback(null, this)
		@db.open db_file, (err) ->
			callback(err)
		
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
	save: (table, obj, in_transaction, the_callback) ->
		
		# store special_cols
		objects_hash: @store_special_cols(obj) if @options.safe_mode
		
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
		table_head: {table_name: table, head: undefined}
		db_head: {table_name: undefined, head: undefined}
		commit: {}
		
		flow.exec(
			->
				# start a transaction if we aren't in one
				if tx_flag then return this()
				db.execute "begin exclusive transaction;", this
			->
				# prepare the statement
				self.prepare_statement(table, objs[0], this)
			(err, statement1) ->
				if err? then return callback(err)
				statement: statement1
				# iterate through and save each object
				this_flow: this
				flow.serialForEach(objs, 
					(the_obj) ->
						this_serial: this
						statement.reset()
						self.bind_obj statement, the_obj
						statement.step ->
							this_serial()
					(error, res) ->
						if error?
							sys.debug("Throwing error inside save")
							throw error
					this_flow
				)
			->
				if tx_flag or not self.options.safe_mode then return this()
				# find the latest head of the db, we will use this for the parent of the commit
				self.find "nsl_head", {"table_name is": undefined}, this
			(err, res) ->
				#find the the table head now
				db_head: res[0] if res? and res.length is 1
				if tx_flag or not self.options.safe_mode then return this()
				self.find "nsl_head", {table_name: table}, this				
			(err, res) ->
				# Save a commit object
				if tx_flag or not self.options.safe_mode then return this()
				# we ignore errors from the last step since the nsl_head might simply not exist
				table_head: res[0] if res? and res.length is 1
				#create and save the commit object
				# we add a blank commit_id here just so that is the first column in the table
				commit.hash: ""
				commit.table_name: table
				commit.created_at: new Date().toISOString()
				commit.objects_hash: objects_hash 
				commit.parent: ""
				commit.parent: db_head.head if db_head.head?
				commit.hash : self.hash_object(commit)
				self.insert_object("nsl_commit", commit, this)
			(err, commit) ->
				if tx_flag or not self.options.safe_mode then return this()
				this_flow: this
				# update the heads table with db head (table is empty)
				db_head.head: commit.hash
				table_head.head: commit.hash
				self.insert_object "nsl_head", db_head, true, (err, res) ->
					if err? then throw err
					self.insert_object("nsl_head", table_head, true, this_flow)
			(err, res)->
				if tx_flag or not self.options.safe_mode then return this()
				if err? then throw err
				self.db.execute("update log set commit_hash='${commit.hash}' where commit_hash='PENDING'", this)
			(err, res)->
				# commit the transaction
				if tx_flag or not self.options.safe_mode then return this()
				if err? then throw err
				db.execute "commit;", this
			->
				# callback to the user
				callback(null, commit) if callback?
		)
	
	
	# Prepares a statement and returns it
	# If the table doesn't exist, creates it 
	prepare_statement: (table, obj, callback) ->
		self: this
		insert_sql = sql.insert(table, obj, false, self.options.core_data_mode).name_placeholder
		do_work: ->
			self.db.prepare insert_sql, (err, the_statement) ->
				if err?
					# This is NoSQLite, let's see if we can fix this!
					compensating_sql: self.compensating_sql(table, obj, err) 
					if compensating_sql?
						self.db.execute compensating_sql, null, (err) ->
							if err? then callback(err) if callback?
							else do_work()
					else
						sys.debug(err)
						return callback(err) if callback?
				else
					callback(null, the_statement)
		do_work()
		
	# Inserts an object directly by escaping the values 
	# Creates the table if it doesn't exist
	# returns the object
	insert_object: (table, obj, replace, the_callback) ->
		self: this
		replace_flag: false
		if _.isBoolean(replace)
			callback: the_callback
			replace_flag: true 
		else callback: replace
		
		insert_sql = sql.insert(table, obj, replace_flag, self.options.core_data_mode).escaped
		
		do_work: ->
			self.db.execute insert_sql, (err, res) ->
				if err?
					# This is NoSQLite, let's see if we can fix this!
					compensating_sql: self.compensating_sql(table, obj, err) 
					if compensating_sql?
						self.db.execute compensating_sql, null, (err) ->
							if err? then callback(err) if callback?
							else do_work()
					else
						return callback(err) if callback?
				else
					callback(null, obj)
		do_work()
		
	compensating_sql: (table, the_obj, the_err) ->
		err: if the_err? and the_err.message? then the_err.message else the_err
		@parse_error(err)
		return compensating_sql: 
			switch @errobj.code
				when NO_SUCH_TABLE then sql.create_table(table, the_obj, @options.core_data_mode).sql
				when NO_SUCH_COLUMN then sql.add_column(table, @errobj.column, null, @options.core_data_mode).sql
				else null
	
	# Stores a SHA-1 hash of the object on the objects object_id key
	# object can be an array in which case the SHA_1 will be calculated on 
	# each item of the array and a SHA_1 of all the object_ids will
	# be returned
	# the hash is stored on the property, hash name
	store_special_cols: (object) ->
		hash_name: "hash"
		if _.isArray(object) then obj_arr: object 
		else obj_arr: [object]

		hash_string: ""

		for obj in obj_arr
			# this will get set to the real commit has at the end of the transaction
			obj["commit_hash"]: "PENDING" if not obj["commit_hash"]?
			# move hash to parent
			obj["parent"]: obj[hash_name] if obj[hash_name]? and obj[hash_name] isnt ""
			sha1: @hash_object(obj)
			obj[hash_name]: sha1
			hash_string += sha1

		return hashlib.sha1(hash_string)	

	# Creates a SHA-1 hash of the object's contents 
	# in the piped export format of SQLite.
	hash_object: (object) ->
		values: ""
		i: 0
		keys_length: Object.keys(object).length - 1
		for key, value of object
			values += value 
			values += "|" if i++ < keys_length
		return hashlib.sha1(values)
			
		
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
		@db.close ->
		
	
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

	migrate_table: (table, convert_callback, callback) ->
		self: this
		temp_table_name: "${table}_backup"
		sys.debug "Migrating table: ${table}"
		defer self.db.execute "begin exclusive transaction"

		# 1. create the temp table
		[err, res]: defer self.find table, {rowid: 1}
		row1: res[0]
		delete row1.rowid
		create_temp_table_sql: sql.create_temp_table(table, row1)
		defer self.db.execute create_temp_table_sql

		# 2. dump all rows to the temp table 
		return_row_id: false
		select_sql: "select * from ${table}"
		dump_sql: "insert into ${temp_table_name} ${select_sql};"
		[err, res]: defer self.db.execute dump_sql
		if err? then return callback(err)

		# 3. drop and recreate the table
		drop_table_sql: "drop table ${table}"
		[err, res]: defer self.db.execute drop_table_sql
		if err? then return callback(err)
		# we use the first object to convert
		# so we get the new schema correct
		obj1: convert_callback(row1)
		create_table_sql: sql.create_table(table, obj1).sql
		err: defer self.db.execute create_table_sql
		if err? then return callback(err)
		# commit and close the transaction
		defer self.db.execute "commit"

		# 4. Prepare statements to 
		# convert the rest of the rows and save to new table
		[err, statement]: defer self.db.prepare "select * from ${temp_table_name} where rowid >= 1"
		if err? then return callback(err)

		# open up another connection to the db
		db1: new sqlite.Database()
		defer db1.open self.db_file
		db1.execute "begin exclusive transaction"
		[err, statement1]: defer db1.prepare sql.insert(table, obj1).name_placeholder
		if err? then return callback(err)

		# 5. Step through each row of the temp table 
		# , call the convert_callback
		# , and then in another sqlite connection insert the row
		# into the new table. 
		#  This way all rows are not read into memory
		migrate_rows: ->
			[err, row]: defer statement.step()
			if not row? then return cleanup_and_callback()
			try
				converted_obj: convert_callback(row)
			catch error
				return callback(err)
			statement1.reset()
			self.bind_obj statement1, converted_obj
			# step once to do the insert
			err: defer statement1.step()
			return callback(err) if err?
			migrate_rows()
		migrate_rows()

		cleanup_and_callback: ->
			# 6.clean up 
			defer db1.execute "commit"
			defer statement.finalize()
			defer statement1.finalize()
			defer db1.close()

			# 7. drop the temp table and alert the callback
			[err, res]: defer self.db.execute "drop table ${temp_table_name}"
			if err? then return callback(err)
			callback(null, "success") if callback?
		
		
	# Syncing code
	# This group is devoted to plumbing functions that sync 2 tables, I mean refs, I means dbs
	# It works for all 3.  It's magic.
	
	# fetches all the objects from a table after supplied commit 
	fetch_objects: (table, commit_hash, callback) ->
		[err, res]: defer @db.execute """select * from ${table} where commit_hash in 
				(select hash from nsl_commit where rowid > 
				(select rowid from nsl_commit where hash = :head))""", [commit_hash]
		callback(null, res)
	
	#fetches all commits from the db and their objects after supplied commit
	# If all commits are wanted, supply an empty commit_hash
	fetch_commits: (commit_hash, callback) ->
		self: this
		# get all the latest commits
		commit_hash: "" if not commit_hash?
		[err, res]: defer @db.execute """select count(*) from nsl_commit where rowid >= 
				(select rowid from nsl_commit where parent = :head)""", [commit_hash]
		if err? then return callback(err)
		if count is 0 then callback(null, [])
		
		# if there is a reasonable number then simply loop through and pull the objects
		# from each table
		count: res[0]["count(*)"]
		if count < 10000
			pulled_commits: []
			# pull the actual commits 
			[err, commits]: defer self.db.execute """select * from nsl_commit where rowid >=
			    (select rowid from nsl_commit where parent = :head)""", [commit_hash]
			if err? then return callback(err)
			zip_objects: ->
				commit: commits.shift()
				if not commit? then return callback(err, pulled_commits) 
				[err, objects]: defer self.db.execute "select * from ${commit.table_name} where commit_hash = '${commit.hash}'"
				commit.objects: objects
				pulled_commits.push(commit)
				zip_objects()
			zip_objects()
		else return callback(new Error("TODO: implement lookup for over 1000 commits"))

	# Updates the remote table with a new remote to connect to
	add_remote: (remote_name, port, host, callback) ->
		self: this
		remote: {name: remote_name, port: port, host: host}
		self.insert_object "nsl_remote", remote, false, (err, res) ->
			if err? then return callback(err)
			callback(null, remote)
		
	# Connects to another NoSQLite instance identified by remote over HTTP
	# and fetches all commits from that DB since the last pull.
	# Follows the merge strategy setup in options.	
	pull: (remote_name, callback) ->
		self: this
		# pull the remote
		[err, res]: defer self.find("nsl_remote", {name: remote_name})
		remote: res[0] if res?
		url: "/?method=fetch"
		if remote? and remote.head? then url += "&remote_head=${remote.head}"
		#create an http client to the url of the remote
		client: http.createClient(remote.port, remote.host)
		request: client.request('GET', url, {})
		body: ""
		request.end()
		response: defer request.addListener 'response'
		
		sys.puts('STATUS: ' + response.statusCode);
		response.setEncoding('utf8')
		
		response.addListener "data", (data) ->
			body += data
		
		response.addListener "end", ->
			try
				commits: JSON.parse(body)
			catch err
				throw new Error("Unable to pull messages. Remote NoSQLite instance returned: " + body)
				
			sys.debug("Fetched ${commits.length} commits from ${remote.host}:${remote.port}")
			sys.debug("Verifying...")
			# TODO: verification step here
			last_commit: {}
			process_commits: ->
				commit: commits.shift()
				if not commit? then return save_remote()
				last_commit: commit
				# first save the objects that make up the commit
				[err, res]: defer self.save(commit.table_name, commit.objects, true)
				if err? then return callback(err)
				delete commit.objects
				[err, res]: defer self.insert_object("nsl_commit", commit)
				if err? then return callback(err)
				process_commits()
			
			save_remote: ->
				remote.head: last_commit.hash
				[err, res]: defer self.insert_object("nsl_remote", remote, true)
				if err? then return callback(err)
				return self.db.execute "commit", ->
					sys.debug("Pull complete")
					return callback(null, "success")
			
			defer self.db.execute "begin exclusive transaction;"
			process_commits()
			
				

	# Web API
	# --------------------------------------
	write_res: (response, err, result) ->
		if err?
			response.writeHead(500, {"Content-Type": "text/plain"})
			response.write(err.message)
		else
			response.writeHead(200, {"Content-Type": "text/plain"})
			response.write(JSON.stringify(result))											
		response.end();

	# Starts a webserver on the supplied port to serve http requests
	# for the instance's associated database.
	# If NoSQLite has already started a webserver on that port
	# this method returns silently. 
	listen: (port, host) ->
		port: 5000 if not port?
		http: require "http" if not http?
		self: this	
		server: http.createServer( (request, response) ->
			sys.debug("NoSQLite received request")
			body: ""
			url: require("url").parse(request.url, true)
			if not url.query?  or not url.query.method?
				response.writeHead(500, {"Content-Type": "text/plain"})
				response.write("Must supply method param")
				response.end();
				return
			table: url.query.table
			# Parse the url to see what the user wants to do
			request.setBodyEncoding('utf8');
			request.addListener "data", (data) ->
				body += data
			request.addListener "end", ->
				body_obj: {}
				
				parse_body: ->
					try
						return  JSON.parse(body)
					catch error
						self.write_res(response, new Error("Unable to parse HTTP body as JSON.  Make sure it is valid JSON.  Error: " + error.message))
										
				try
					switch url.query.method
						when "fetch" 
							remote_head: url.query.remote_head
							sys.debug("remote_head: " + typeof remote_head) 
							if not table?
								self.fetch_commits remote_head, (err, result) ->
									self.write_res(response, err, result)
						when "save" 
							body_obj: parse_body()
							self.save(table, body_obj, false, (err, result) ->
								self.write_res(response, err, result)
							 )
						when "find" 
							predicate: JSON.parse(body)
							if predicate.records?
								# The client is sending some records to save along with asking for new records
								# This is for convenience for clients that want to do a simple sync in one http call
								records_to_save: predicate.records
								predicate: predicate.predicate
								self.save table, records_to_save, (err, result) ->
									if err? then return self.write_res(response, err)
									self.find table, predicate, (err, result) ->
										self.write_res(response, err, result)
							else
								self.find table, predicate, (err, result) ->
									self.write_res(response, err, result)
							 
						when "find_or_save" 
							args: JSON.parse(body)
							self.find_or_save(table, args[0], args[1], (err, result) ->
								self.write_res(response, err, result)
							 )
						else
							response.writeHead(500, {"Content-Type": "text/plain"})
							response.write("Unrecognized method: ${url.query.method}")
							response.end();
				catch err
					self.write_res(response, err, null)
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
	