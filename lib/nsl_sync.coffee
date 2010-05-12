# Syncing functions
sys: require "sys"
sqlite: require "sqlite"
http: require "http"

nsl_obj_statement: {}
plink_statement: {}
unclustered_statement: {}
unsent_statement: {}

# Hooks

# Prepares all the statements

# Called at the beginning of a save transaction
prepare_save_statements: (db, callback) ->
	self.db.prepare_statement "insert into nsl_obj(oid, uuid, table) values(:oid, :uuid, :table)", (err, statement) ->
	 	nsl_obj_statement: statement
		self.db.prepare_statement "insert into plink(pid, cid, is_primary) values(:pid, :cid, :is_primary)", (err, statement) ->
			plink_statement: statement
			self.db.prepare_statement "insert into unclustered(oid) values(:oid)", (err, statement) ->
				unclustered_statement: statement
				self.db.prepare_statement "insert into unsent(oid) values(:oid)", (err, statement) ->
					unsent_statement: statement
					callback()
										
execute_save_statements: (db, table, obj, callback)					
	self.db.execute()
	
#pre_insert hooks
exports.module_init: ()	->
	self.add_presave_hook(prepare_save_statements)
	self.add_post_insert_hook(execute_sync_statements)

	
# inserts an nsl_obj
# the statement should of been prepared so that it can be re-used	
insert_nsl_obj: (nsl_obj_statement, table, obj, callback) ->
	# Todo check the uuid policy
	uuid: hash_obj(obj)
	nsl_obj: {oid, obj.rowid, table: table, uuid: uuid}
	execute_statement nsl_obj_statement, nsl_obj, callback)

insert_plink: (plink_statement, obj, callback) ->	
	if obj.parent?
		
# Updates the remote table with a new remote to connect to
exports.add_remote: (remote_name, port, host, callback) ->
	self: this
	remote: {name: remote_name, port: port, host: host}
	self.insert_object "nsl_remote", remote, false, (err, res) ->
		if err? then return callback(err)
		callback(null, remote)
	
# Connects to another NoSQLite instance identified by remote over HTTP
# and fetches all commits from that DB since the last pull.
# Follows the merge strategy setup in options.	
exports.pull: (remote_name, callback) ->
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
	
	response.setEncoding('utf8')
	
	response.addListener "data", (data) ->
		body += data
	
	response.addListener "end", ->
		try
			commits: JSON.parse(body)
		catch err
			throw new Error("Unable to pull messages. Remote NoSQLite instance returned: " + body)
			
		sys.puts("Fetched ${commits.length} commits from ${remote.host}:${remote.port}")
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
				sys.puts("Pull complete")
				return callback(null, "success")
		
		if commits.length > 0
			defer self.db.execute "begin exclusive transaction;"
			process_commits()
		else
			sys.puts "Pull complete"
			

			
