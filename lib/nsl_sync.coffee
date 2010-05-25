# Syncing module
if not window?
	sys: require "sys"
	uuid: require "Math.uuid"
	
class NSLSync
	
	constructor: (nosqlite) ->
		@nosqlite: nosqlite;
		nosqlite.after_save_triggers.push(@post_save_trigger)
	
	# Return a nsl_obj for every object inserted
	# We might also need an entry in the plink table
	# if the row is an update
	after_save: (obj_desc, obj, rowid) ->
		
		# ignore nsl tables or if this object was part of a sync
		return if obj_desc.table.startsWith("nsl_") or obj_desc.sync?
		# else return a obj_desc for an nsl_obj followed by a couple
		# couple of more entries
		{
			table: "nsl_obj_desc"
			, obj: {
		 		rowid_name: "oid"
				, obj_rowid: rowid,
				, uuid: hashlib.sha1(JSON.stringify(obj))
				, tbl_name: obj_desc.table
				, contents: obj # store as a JSON blob
				, date_created: new Date().toISOString() 
			}
			, after: (table, obj, oid) ->
				# we always put an entry in unclustered. 
				return [
					{ table: "nsl_unclustered", obj: {oid: oid}} 
					, {table: "nsl_unsent", obj: {oid: oid}}
				]
		}

	# Returns nsl_objs in buckets not in another bucket.
	# where buckets are like phantom, unclustered and unsent
	obj_descs_in_bucket: (bucket, exclude_bucket, callback)  ->
		self: this
		sql: "SELECT * FROM ${bucket} JOIN nsl_obj_desc USING(oid)"
		if exclude_bucket?
			sql += "WHERE NOT EXISTS (SELECT 1 FROM ${exclude_bucket} WHERE oid=nsl_obj_desc.oid)"
			self.nosqlite.query sql, (err, res) ->
				if err? then return callback(err)
				return callback(null, res)
	
	# Returns the complete obj  		
	objs_in_bucket: (bucket, exclude_bucket, callback) ->
		# first we need a list of oids
		objs: []
		self.nsl_objs_in_bucket bucket, exclude_bucket, (err, nsl_objs) ->
			if err? then return callback(err)
			tables: _.pluck(nsl_objs, "tbl_name")
			oids: _.pluck(nsl_objs, "oid").join(",")
			throw new Error("incomplete")
			
	# Returns all the objs described by obj_descs		
	get_objs: (obj_descs, callback) ->
		uuids: _.pluck(obj_descs, "uuid")
		nosqlite.execute("SELECT content FROM nsl_obj WHERE uuid in (${uuids}) ", callback)
			
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
		obj_descs_in_bucket "nsl_unclustered", (err, unclustered)->
			if unclustered.length >= @CLUSTER_THRESHOLD
				# store the cluster in nsl_cluster
				cluster_desc: {
					table: "nsl_cluster"
					, obj: {
					 	rowid_name: "cluster_id"
						, content: unclustered # store as a JSON blob 
						, date_created: new Date().toISOString() 
						}
				}
									 
				nosqlite.save cluster_desc, ->
					# delete all records from unclustered
					# and insert the clustered
					nosqlite.execute "delete from unclustered", ->
						callback()
	
	# Returns the obj_desc object if it exists.
	# 
	# If it doesn't exist, and phantomize is true,
	# then creates a blank entry in nsl_obj_desc
	# and adds an entry to phantom
	uuid_to_obj_desc: (uuid, phantomize, callback) ->
		nosqlite.find "nsl_obj_desc", {uuid: uuid}, (err, obj_desc) ->
			return callback(err) if err?
			if obj_desc? then return callback(null, obj_desc)
			else create_phantom(uuid, callback) if phantomize
			else callback()
				
	# Creates a phantom
	# 
	# create a blank entry nsl_obj_desc
	# and then a phantom obj for the blank
	create_phantom: (uuid, callback) ->
		obj_desc: {
			table: "nsl_obj_desc"
			, obj: {
				 tbl_name: null
				, obj_rowid: null
				, uuid: uuid 
				, contents: null
				, date_created: new Date().toISOString()
			}
			, after: (obj_desc, obj, rowid) ->
				return {
					table: "nsl_phantom"
					, obj: {
						oid: rowid
					}
				}
		}
		nosqlite.save(obj_desc, callback)
		
	# Processes objects received from another db
	# 
	# If the obj uuid already exists in nsl_obj, ignore the obj.
	# Otherwise, store the obj in nsl_obj and in it's table.
	# If the never before seen object is a cluster, store each obj
	# in the cluster and store the cluster itself as an obj.
	process_objs: (obj_descs, callback) ->
		for obj_desc in obj_descs
			# see if this object exists yets
			nosqlite.execute "SELECT 1 FROM nsl_obj_desc WHERE uuid = ?", (err, found) ->
				return callback(err) if err?
				continue if found is 1
					
	# Local implementation of the pull protocol
	# req should have a method called write to write the body of the request
	# and send to the request
	pull_request: (req, callback) ->
		self: this
	
		# this cycle is called until there are no more items left in phantom to send
		first_cycle: true
		pull_cycle:  ->
			flow.exec(
				->
					# get all the objects in phantom
					obj_descs_in_bucket("nsl_phantoms", this)
				(err, phantoms) ->
					# stop pulling if no more phantoms needed
					return if not first_cycle and phantoms.length is 0
					first_cycle: false
					# prepare the login requests
					# send phantoms
					req.write({cmd: "gimme", content: phantoms})
					req.send(this)
				(err, res) ->
					# the response came back
					# add these objs, this creates phantoms
					# for never before seen objs
					process_objs(res.objs)
					# start over
					pull_cycle()
			)
		pull_cycle()
		callback()


	# Remote side implementation of the pull protocol
	# 
	# res should have a method called write in which the response should be written
	# callback will be called when this method is done writing
	pull_response: (req, res, callback) ->
		flow.exec(
			->
				# Take this opportunity to make a cluster if we need to.
				# This choice of a place to make sluster favors 
				# master-slave configurations, but works for any config
				make_cluster(this)
			(err) ->	
				# pull all the objs requested
				get_objs(_.pluck(_.pluck(req.body, "gimme"), "content"))
			(err, objs) ->
				# send these back to the local client
				res.write(JSON.stringify(objs))
			(err) ->
				# get all objs in unclustered not in phantom
				objs_in_bucket "unclustered", "phantom", false, this
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
				objs_in_bucket("unsent", this)
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
