# Syncing module
if not window?
	sys: require "sys"
	NSLCore: require("./nosqlite").NSLCore
	hex_sha1: require("../vendor/sha1").hex_sha1
else
	NSLCore: window.NSLCore
	hex_sha1: window.hex_sha1
	
class NSLSync extends NSLCore
	
	# Extends the core NoSQLite save_obj functions
	# Creates a nsl_obj entry for each user obj 
	#
	# Stores an attribue called oid in the user table
	# that references the nsl_obj
	# Also stores auxilary objs needed for syncing  
	save_objs: (the_obj_desc, callback) ->
		# we accept an array or a single object
		obj_descs = if _.isArray(the_obj_desc) then the_obj_desc else [the_obj_desc]
	
		# store a nsl_obj for each user obj
		nsl_obj_descs: []
		for obj_desc in obj_descs
			after: (obj_desc, obj, oid) ->
				# we always put an entry in unclustered.
				obj_desc.child_desc.obj.nsl_oid: oid
				return [
					obj_desc.child_desc,
					{ table: "nsl_unclustered", obj: {oid: oid}}, 
					{ table: "nsl_unsent", obj: {oid: oid}}
				]
			objs: if _.isArray(obj_desc.obj) then obj_desc.obj else [obj_desc.obj] 			
			for obj in objs	
				nsl_obj_desc: {
					table: "nsl_obj",
					obj: {
				 		rowid_name: "oid",
						uuid: hash_obj(obj),
						tbl_name: obj_desc.table,
						content: obj, 
						date_created: new Date().toISOString()
					},
					child_desc: obj_desc,
				    after: after
				}
				nsl_obj_descs.push(nsl_obj_desc)
			super(nsl_obj_descs, callback)


	# Returns nsl_objs in buckets not in another bucket.
	# where buckets are like phantom, unclustered and unsent
	objs_in_bucket: (bucket, exclude_bucket, callback)  ->
		self: this
		sql: "SELECT * FROM ${bucket} JOIN nsl_obj USING(oid)"
		if exclude_bucket?
			sql += "WHERE NOT EXISTS (SELECT 1 FROM ${exclude_bucket} WHERE oid=nsl_obj.oid)"
			self.execute sql, (err, res) ->
				if err? then return callback(err)
				return callback(null, res)
	
	# Returns the complete obj from it's flattened table 		
	blowup_objs_in_bucket: (bucket, exclude_bucket, callback) ->
		# first we need a list of oids
		objs: []
		self.nsl_objs_in_bucket bucket, exclude_bucket, (err, nsl_objs) ->
			if err? then return callback(err)
			tables: _.pluck(nsl_objs, "tbl_name")
			oids: _.pluck(nsl_objs, "oid").join(",")
			throw new Error("incomplete")
			
	# Sends all the objs requested in the gimme part  		
	send_requested_objs: (req, res, callback) ->
		return if req.gimme.length is 0
		#TODO: security, private, shunned checks on the uuids?
		uuids: req.gimme.join(",")
		nosqlite.execute "SELECT table, uuid, content FROM nsl_obj WHERE uuid in (${uuids}) ", (err, objs)->
			if err? then return callback(err)
			req.objs.push(objs)
			callback()
			
			
	# Makes a cluster from the objs in the unclustered table
	# if the number of objs in unclustered exceeds the cluster threshold.
	#
	# A cluster is a regular obj in nsl_obj and stored in nsl_cluster.
	# They are used to represent one or more objects for more efficient syncing.
	# If another db has the cluster obj, it has all the objs in the cluster.
	# The objects that comprise a cluster are kept in nsl_cluster_link
	# which has this schema.
	# cluster_oid -> The oid of the cluster obj in nsl_obj
	# child_oid -> The oid of a child cluster obj in nsl_obj 
	make_cluster: (callback) ->
		self: this
		obj_descs_in_bucket "nsl_unclustered", (err, unclustered)->
			if unclustered.length >= self.CLUSTER_THRESHOLD
				# store the cluster in nsl_obj 
				cluster_desc: {
					table: "nsl_obj"
					obj: {
					 	rowid_name: "cluster_id",
						table: null,
						obj_rowid: null,
						content: _.pluck(unclustered, uuid), # just a collection of uuids 
						date_created: new Date().toISOString() 
						}
				}
									 
				nosqlite.save cluster_desc, ->
					# delete all records from unclustered
					# and insert the clustered
					nosqlite.execute "delete from unclustered", ->
						callback()
	
	# Returns the obj object if it exists.
	# 
	# If it doesn't exist, and phantomize is true,
	# then creates a blank entry in nsl_obj
	# and adds an entry to phantom
	uuid_to_obj: (uuid, phantomize, callback) ->
		nosqlite.find "nsl_obj", {uuid: uuid}, (err, obj_desc) ->
			return callback(err) if err?
			if obj_desc? then return callback(null, obj_desc)
			else if phantomize then create_phantom(uuid, callback)
			else callback()	
				
	# Creates a phantom
	# 
	# create a blank entry nsl_obj
	# and then a phantom obj for the blank
	create_phantom: (uuid, callback) ->
		obj_desc: {
			table: "nsl_obj"
			obj: {
				tbl_name: null
				uuid: uuid,
				contents: null,
				date_created: new Date().toISOString(),
			},
			after: (obj_desc, obj, rowid) ->
				return {
					table: "nsl_phantom",
					obj: {
						oid: rowid
					}
				}
		}
		nosqlite.save(obj_desc, callback)
		
	# Stores any new objects received from another db
	# 
	# If the obj uuid already exists in nsl_obj, ignore the obj.
	# Otherwise, store the obj in nsl_obj and in it's table.
	# If the never before seen object is a cluster, store each obj
	# in the cluster and store the cluster itself as an obj.
	store_objs: (obj_descs, callback) ->
		# if a lot of these already exist
		@save_objs obj_descs, (err, saved_objs) ->
			if err? then return callback(err)
			if saved_objs.length is 0 then callback(null, 0)
			flow.serialForEach(saved_objs,
				->
					if obj_desc.table is "nsl_cluster"
						uuid_to_obj(uuid, true, this)
					else this()
				null
				->
					callback(null, saved_objs.length)
			)
			
	# Sends any phantoms over
	send_objs_in_bucket: (req_or_res, bucket, exclude_bucket, callback)->
		objs_in_bucket bucket, (err, objs)->
			if phantoms.length > 0
				req_or_res.objs.push(objs)
			callback(null, objs.length)
	
	
	# Pulls from a remote node
	pull: (url, callback) ->
		
		# construct a pull request
		req: {
			type: "pull",
			objs: [],
			gimme: []
		}
		
		# keep track of how many times we have cycled through this
		first_cycle: false
		
		pull_cycle:  ->
			flow.exec(
				->
					send_objs_in_bucket(req, "nsl_phantom", this)
				(err, req) ->
					# exit the flow if no more objs needed
					if not first_cycle and req.gimme.length is 0
						return callback(null)
					if first_cycle is true then first_cycle: false
					# send over the request
					http_client.post(url, req, this)
				(err, res) ->
					# the response came back
					# store these objs if needed, this creates phantoms
					# for never before seen objs
					store_objs(res.objs, this)
					# start over
					pull_cycle()
			)
		pull_cycle()
		

	# Remote side implementation of the pull protocol
	# 
	# callback will be called when this method is done writing
	pull_response: (req, res, callback) ->
		flow.exec(
			->
				# Take this opportunity to make a cluster if we need to.
				# This choice of a place to make a cluster favors 
				# master-slave like configurations, but works for any configurations
				make_cluster(this)
			(err) ->	
				# send all the objs requested
				send_requested_objs(req, res, this)
			(err) ->
				# get all objs in unclustered not in phantom
				send_objs_in_bucket(req, "unclustered", "phantom", false, this)
			(err, unclustered) ->
				# send these to the local db
				res.write(unclustered)
				callback()
		)
	

	# Push implmentation

	push_local: (req, callback) ->
		flow.exec(
			->
				# get all obj that have never before been sent
				send_objs_in_bucket(req, "unsent", this)
			(err, unsent) ->
				# send unsent items
				req.write(unsent)
				# get all objects in unclustered not in phantom
				objs_in_bucket("unclustered", this)
			(err, unclustered) ->
				req.write(unclustered)
				req.send(this)
			(err, res) ->
			
		)
	
	hash_obj: (obj) ->
		return hex_sha1(JSON.stringify(obj))

if not window?
	exports.NSLSync: NSLSync
else
	window.NSLSync: NSLSync