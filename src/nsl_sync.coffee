# Syncing module
if not window?
	sys: require "sys"
	NSLCore: require("./nosqlite").NSLCore
	hex_sha1: require("../vendor/sha1").hex_sha1
	flow: require("../vendor/flow")
	http_client: require "request"
else
	NSLCore: window.NSLCore
	hex_sha1: window.hex_sha1
	
class NSLSync extends NSLCore		
	
	@schema: [
		{
			table: "nsl_phantom"
			rowid_name: "oid"
			objs: [{oid: 1}]
		}
		{
			table: "nsl_unsent"
			rowid_name: "oid"
			objs: [{oid: 1}]
		}
		{
			table: "nsl_unclustered"
			rowid_name: "oid"
			objs: [{oid: 1}]
		}
		{
			table: "nsl_obj"
			rowid_name: "oid"
			objs: [
				{
					oid: 1
					uuid: "text"
					tbl_name: "text"
					content: "text"
					date_created: new Date().toISOString()
				}
			]
		}
		{
			table: "nsl_cluster"
			rowid_name: "cluster_id"
			objs: [
				{
					objs: [] 
					date_created: new Date().toISOString() 
				}
			]
			
		}
	]
	
	create_schema: (obj_descs, callback) ->
		if _.isFunction(obj_descs)
			callback: obj_descs 
			obj_descs: NSLSync.schema
		else 
			obj_descs: [obj_descs, NSLSync.schema]
		super(obj_descs, callback)

	# Num of objs that should be in nsl_unclustered before we create a cluster
	@CLUSTER_THRESHOLD: 10
	
	# Creates a nsl_obj entry for each user obj. 
	# Extends the core NoSQLite save_obj function.
	#
	# Stores an attribute called oid in the user table
	# that references the nsl_obj
	# Also stores auxilary objs needed for syncing  
	save_objs: (the_obj_desc, callback) ->
		# we accept an array or a single object
		obj_descs = if _.isArray(the_obj_desc) then the_obj_desc else [the_obj_desc]
		# store a nsl_obj for each user obj
		nsl_obj_descs: []
		for obj_desc in obj_descs
			if obj_desc.table is "nsl_obj"
				# just ignore nsl objects and pass them  to super
				# to be saved
				nsl_obj_descs.push(obj_desc)
				continue
				
			nsl_obj_desc: {
				table: "nsl_obj"
				objs: []
				rowid_name: "oid"
				unique: ["uuid"]
			}

			if not obj_desc.objs? or not _.isArray(obj_desc.objs)
				throw Error("Each obj_desc should have an objs array on it")
			
			for obj in obj_desc.objs	
				nsl_obj: {
					uuid: @hash_obj(obj)
					tbl_name: obj_desc.table
					content: obj
					date_created: new Date().toISOString()
					nsl_children: []
				}
				nsl_obj_desc.objs.push(nsl_obj)
				# this is the original object which becomes a child
				# obj of nsl_obj
				new_obj_desc: {
					table: obj_desc.table
					objs: [obj]
					fk: "oid"
				}
				
				nsl_obj.nsl_children.push(new_obj_desc)
				nsl_obj.nsl_children.push({ table: "nsl_unclustered", objs: [{oid: null}], fk: "oid"})
				nsl_obj.nsl_children.push({ table: "nsl_unsent", objs: [{oid: null}], fk: "oid"})
				
			nsl_obj_descs.push(nsl_obj_desc)
		super(nsl_obj_descs, callback)


	# Returns nsl_objs in buckets not in another bucket.
	# where buckets are like phantom, unclustered and unsent
	objs_in_bucket: (bucket, exclude_bucket, callback)  ->
		if _.isFunction(exclude_bucket)
			callback: exclude_bucket
			exclude_bucket: null
			
		self: this
		sql: "SELECT * FROM ${bucket} JOIN nsl_obj USING(oid)"
		if exclude_bucket?
			sql += "WHERE NOT EXISTS (SELECT 1 FROM ${exclude_bucket} WHERE oid=nsl_obj.oid)"
		self.find sql, callback
	
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
		return callback() if req.gimme.length is 0
		#TODO: security, private, shunned checks on the uuids?
		uuids: for uuid in req.gimme
			JSON.stringify(uuid)
		uuids: uuids.join(",")
		@find "SELECT * FROM nsl_obj WHERE uuid in (${uuids}) ", (err, objs)->
			sys.debug(sys.inspect(err))
			if err? then return callback(err)
			res.objs.push(objs)
			res.objs: _.flatten(res.objs)
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
		self.objs_in_bucket "nsl_unclustered", (err, unclustered) ->
			if err? then throw err
			if unclustered?.length >= NSLSync.CLUSTER_THRESHOLD

				# delete all records from unclustered
				# and insert the clustered
				self.execute "delete from nsl_unclustered", (err, res) ->
					throw err if err?

					# store the cluster in nsl_obj 
					cluster_desc: {
						table: "nsl_cluster"
						rowid_name: "cluster_id"
						objs: [
							{
								objs: _.pluck(unclustered, "uuid") 
								date_created: new Date().toISOString() 
							}
						]
					}
					self.save_objs cluster_desc, (err, res)->
						throw err if err?
						callback(null, res) if callback?
			else
				callback()
	
	# Returns the nsl_obj if it exists.
	# 
	# If it doesn't exist, and phantomize is true,
	# then creates a blank entry in nsl_obj
	# and adds an entry to phantom
	uuid_to_obj: (uuid, phantomize, callback) ->
		self: this
		@find "nsl_obj", {uuid: uuid}, (err, obj) ->
			return callback(err) if err?
			if obj?
				# delete obj from phantom
				self.execute "DELETE FROM nsl_phantom WHERE oid = ${obj[0].oid}", (err, results) ->
					callback(null, obj[0])
			else if phantomize then self.create_phantom(uuid, callback)
			else callback()	
				
	# Creates a phantom
	# 
	# create a blank entry nsl_obj
	# and then a phantom obj for the blank
	create_phantom: (uuid, callback) ->
		obj_desc: {
			table: "nsl_obj"
			objs: [
				{
					tbl_name: null
					uuid: uuid
					content: null
					date_created: new Date().toISOString()
					nsl_children: [
						{
							table: "nsl_phantom"
							fk: "oid"
							objs: [
								{	
								oid: null
							}]
						}
					]
				}
			]
		}
		@save_objs(obj_desc, callback)
		
	# Stores any new objects received from another db
	# 
	# If the obj uuid already exists in nsl_obj, ignore the constraint error.
	# Otherwise, store the obj in nsl_obj and in it's table.
	# If the never before seen object is a cluster, store each obj
	# in the cluster and store the cluster itself as an obj.
	store_objs: (objs, callback) ->
		self: this
		obj_desc: {
			table: "nsl_obj"
			rowid_name: "oid"
			objs: _.flatten(objs)
			ignore_constraint_errors: true
		}
		@save_objs obj_desc, (err, res) ->
			if err? then return callback(err)
			flow.serialForEach(
				objs
				(obj) ->
					this_flow: this
					if obj.tbl_name is "nsl_cluster"
						flow.serialForEach(
							obj.content.objs
							(uuid) ->
								self.uuid_to_obj(uuid, true, this)
							(err, res) ->
								throw err if err?
							this_flow
						)
					else
						#TODO: test for parent id
						this_flow()
				null
				->
					callback(null, res.rowsAffected)
			)
			
			
	# Sends any objs over
	send_objs_in_bucket: (arr, bucket, exclude_bucket, callback) ->
		@objs_in_bucket bucket, exclude_bucket, (err, objs) ->
			callback(err) if err?
			if objs?.length > 0
				arr.push(objs)
				arr: _.flatten(arr)
			callback(null, objs?.length)
	
	
	# Pulls from a remote node
	pull: (url, db, callback) ->
		self: this
		# construct a pull request
		req: {
			db: db
			objs: []
			gimme: []
		}
		
		# keep track of how many times we have cycled through this
		first_cycle: true
		
		pull_cycle:  ->
			flow.exec(
				->
					self.objs_in_bucket("nsl_phantom", null, this)
				(err, objs) ->
					throw err if err?
					if not first_cycle and not objs?
						return callback(null)
					else if objs?.length > 0
						sys.debug(sys.inspect("found objects"))
						req.gimme.push(_.pluck(objs, "uuid"))
					first_cycle: false
					# send over the request
					req.objs: _.flatten(req.objs)
					req.gimme: _.flatten(req.gimme)
					http_client({uri: url, method: "POST", body: JSON.stringify(req)}, this)
				(err, http_res, body) ->
					throw err if err?
					# the response came back
					# store these objs if needed, this creates phantoms
					# for never before seen objs
					res: JSON.parse(body)
					self.store_objs(res.objs, this)
					# start over
				(err, results) ->
					throw err if err?
					pull_cycle()
			)
		pull_cycle()
		

	# Remote side implementation of the pull protocol
	# 
	# callback will be called when this method is done writing
	pull_response: (req, res, callback) ->
		self: this
		flow.exec(
			->
				# Take this opportunity to make a cluster if we need to.
				# This choice of a place to make a cluster favors 
				# master-slave like configurations, but works for any configurations
				self.make_cluster(this)
			(err) ->	
				# send all the objs requested
				self.send_requested_objs(req, res, this)
			(err) ->
				# get all objs in unclustered not in phantom
				self.send_objs_in_bucket(res.objs, "nsl_unclustered", "nsl_phantom",  this)
			(err, num_sent) ->
				callback()
		)
	

	# Push implmentation

	push: (req, callback) ->
		flow.exec(
			->
				# get all obj that have never before been sent
				send_objs_in_bucket(req.objs, "nsl_unsent", null, this)
			(err, unsent) ->
				# send unsent items
				req.write(unsent)
				# get all objects in unclustered not in phantom
				objs_in_bucket("nsl_unclustered", this)
			(err, unclustered) ->
				req.write(unclustered)
				req.send(this)
			(err, res) ->
				callback()
		)
		
	push_response: (req, res, callback) ->
		self: this
		flow.exec(
			->
				# Take this opportunity to make a cluster if we need to.
				# This choice of a place to make a cluster favors 
				# master-slave like configurations, but works for any configurations
				self.make_cluster(this)
			(err) ->	
				# send all the objs requested
				self.send_requested_objs(req, res, this)
			(err) ->
				# get all objs in unclustered not in phantom
				self.send_objs_in_bucket(res.objs, "nsl_unclustered", "nsl_phantom",  this)
			(err, num_sent) ->
				callback()
		)
		
	
	hash_obj: (obj) ->
		return hex_sha1(JSON.stringify(obj))

if not window?
	exports.NSLSync: NSLSync
else
	window.NSLSync: NSLSync