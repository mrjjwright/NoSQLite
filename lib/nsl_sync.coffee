# Syncing functions
sys: require "sys"
sqlite: require "sqlite"
http: require "http"

nsl_obj_statement: {}
plink_statement: {}
unclustered_statement: {}
unsent_statement: {}

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


# Saves a few objects needed for syncing in the database
save_sync_hook: (rowid, obj_desc) ->
	nsl_obj: {
		oid: rowid,
		uuid: "xx",
		table: obj_desc.table
	}
	return [
		{table: "nsl_obj", obj: nsl_obj},
		{ table: "unclustered", obj: {oid: rowid}},
		{table: "unsent": obj: {oid: rowid}}]
					
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

if not window?
	exports.save_sync_hook: save_sync_hook
			
