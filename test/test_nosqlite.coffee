require.paths.unshift "vendor"
sys: require "sys"
nosqlite: require("../lib/nosqlite").nosqlite
fs: require "fs"
assert: require "assert"

remove_file: (file) ->
	try
		fs.unlinkSync(file)
	catch err
		sys.puts err
	

test_find: ->
	db_file: "./test/test_find.db"
	remove_file(db_file)
	
	db: nosqlite.open db_file, ->
		log: {
			text: "hello",
			occurred_at: new Date().getTime(),
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
			source: "string1",
			log_type: "string1",
			geo_lat: "string1",
			geo_long: "string1",
			metric:  5,
			external_id: 10,
			level: 5,
			readable_metric: "5 miles",
			facts: ["hello", "hello", "hello1"],
			original: {id: 1, text: "some crazy object"} 
		}

		db.save {table: "log", obj: log}, null, (err, res) ->
			throw err if err?
			db.find "log", {text: "hello"},  (err, result) ->
				throw err if err?
				assert.equal(result[0].text, "hello", "should find single object")
				assert.equal(result[0].facts[2], "hello1", "should recreate arrays")
				assert.equal(result[0].original.id, 1, "should recreate complex Objects")

test_sync: ->
	db_file: "./test/test_sync.db"
	remove_file(db_file)
	
	db: nosqlite.open db_file, ->
		log: {
			text: "hello",
			occurred_at: new Date().getTime(),
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
			source: "string1",
			log_type: "string1",
			geo_lat: "string1",
			geo_long: "string1",
			metric:  5,
			external_id: 10,
			level: 5,
			readable_metric: "5 miles",
			facts: ["hello", "hello", "hello1"],
			original: {id: 1, text: "some crazy object"} 
		}
		db.save "log", log, null, (err, res) ->
			throw err if err?
			db.find "log", {text: "hello"},  (err, result) ->
				throw err if err?
				assert.equal(result[0].text, "hello", "should find single object")
				assert.equal(result[0].facts[2], "hello1", "should recreate arrays")
				assert.equal(result[0].original.id, 1, "should recreate complex Objects")
				db.find "nsl_obj", {tbl_name: "log"}, (err, res) ->
					throw err if err?
					assert.equal(res[0].tbl_name, "log", "should find aux obj")
					sys.debug("Test simple save and find: passed")

test_save_cd: ->
	db_file: "./test/test_save_cd.db"
	remove_file(db_file)
	options: {}
	options.core_data_mode: true
	db: nosqlite.open db_file, ->
		log: {
			text: "hello",
			occurred_at: new Date().getTime(),
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
			source: "string1",
			log_type: "string1",
			geo_lat: "string1",
			geo_long: "string1",
			metric:  5,
			external_id: 10,
			level: 5,
			readable_metric: "5 miles",
			facts: ["hello", "hello", "hello1"],
			original: {id: 1, text: "some crazy object"} 
		}

		db.save("log", log, (err, res) ->
			assert.equal(res, "success", "should save single obj")
		)


test_update_object: ->
	db_file: "./test/test_update_object.db"
	remove_file(db_file)

	db: nosqlite.open db_file, ->
		log: {
			text: "hello",
			created_at: new Date().getTime(),
		}

		db.save("log", log, false, (err, res) ->
			assert.equal(res.length, 1, "should save single obj")
			object_hash: res[0].hash
			log: res[0]
			log.text: "hello1"
			db.save("log", log, false, (err, res) ->
				assert.equal(res.length, 1, "should update single obj by adding a new")
				assert.equal(res[0].parent, object_hash, "parent hash should be old version's hash")
			)
		)

test_save: ->
	db_file: "./test/test_save.db"
	remove_file(db_file)

	db: nosqlite.open db_file, ->
		log: {
			text: "hello",
			created_at: new Date().getTime(),
		}
		db.save("log", log, (err, sql_result_set) ->
			assert.equal(sql_result_set.rowsAffected, 1, "should save single obj")
		)	
	
test_save_multiple: ->
	db_file: "./test/test_save_multiple.db"
	#remove_file(db_file)
	
	db: nosqlite.open db_file, ->
		logs: [
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string2",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			}
		]
	

		db.save("log", logs, false, (err, res) ->
			assert.equal(res.table_name, "log", "should save multiple obj and return commit object")
			db.close()
		)

	
test_save_bulk: ->
	db_file: "./test/save_bulk.db"
	remove_file(db_file)
	options: {}
	
	db: nosqlite.open db_file, ->
		log: {
			text: "hello",
			occurred_at: new Date().getTime(),
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
			source: "string1",
			log_type: "string1",
			geo_lat: "string1",
			geo_long: "string1",
			metric:  5,
			external_id: 10,
			level: 5,
			readable_metric: "5 miles",
			facts: ["hello", "hello", "hello1"],
			original: {id: 1, text: "some crazy object"} 
		}
	
		logs: []
		for i in [1..200000]
			logs.push(_.clone(log))
	
		db.save("log", logs, (err, res) ->
			assert.equal(res.rowsAffected, 200000, "should save 250000 log messages quickly")
		)
		
test_objects_since_commit: ->

	db_file: "./test/test_objects_since_commit.db"
	remove_file(db_file)

	db: nosqlite.open db_file, ->
		logs: [
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
		]
		
		logs2: [
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
			log: {
				text: "hello2",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			}
		]
		
		db.save("log",  logs, (err, commit) ->
			sys.debug(sys.inspect(commit))
			#assert.equal(commit, "hello", "should store the first commit")
			# store another commit
			db.save "log", logs2, (err1, commit2) ->
				db.objects_since_commit "log", commit.hash, (err, objects) ->
					assert.equal objects.length, 2, "should pull 2 objects object"
					db.close()
		)

test_fetch_commits: ->

	db_file: "./test/test_fetch_commits.db"
	remove_file(db_file)

	db: nosqlite.open db_file, ->
		logs: [
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
		]

		logs2: [
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
			log: {
				text: "hello2",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			}
		]

		db.save("log",  logs, (err, commit) ->
			sys.debug(sys.inspect(commit))
			#assert.equal(commit, "hello", "should store the first commit")
			# store another commit
			db.save "log", logs2, (err1, commit2) ->
				db.fetch_commits commit.hash, (err, objects) ->
					assert.equal objects.length, 1, "should pull 1 commit"
					db.close()
		)
		

test_find_or_save: ->
	db_file: "./test/test_find_or_save.db"
	remove_file(db_file)

	db: nosqlite.open db_file, ->
		logs: [
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
			log: {
				text: "hello",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			},
			log: {
				text: "hello2",
				occurred_at: new Date().getTime(),
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
				source: "string1",
				log_type: "string1",
				geo_lat: "string1",
				geo_long: "string1",
				metric:  5,
				external_id: 10,
				level: 5,
				readable_metric: "5 miles",
				facts: ["hello", "hello", "hello1"],
				original: {id: 1, text: "some crazy object"} 
			}
		]

		db.find_or_save("log", {text: "hello"}, logs, (err, res) ->
			assert.equal(res, 2, "should save not find these obj")
			db.close()
		)


test_save_web: ->

	db_file: "./test/test_save_web.db"
	remove_file(db_file)
	
	#start the listener
	db: nosqlite.open db_file, ->
		server: db.listen(5000)
	
		log: {
			text: "hello",
			occurred_at: new Date().getTime(),
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
			source: "string1",
			log_type: "string1",
			geo_lat: "string1",
			geo_long: "string1",
			metric:  5,
			external_id: 10,
			level: 5,
			readable_metric: "5 miles",
			facts: ["hello", "hello", "hello1"],
			original: {id: 1, text: "some crazy object"} 
		}
	
		url: "http://localhost:5000?method=save&table=log"
		rest.post(url, {data: JSON.stringify(log)}).addListener("complete", (data) ->
			assert.equal(data, "success,", "should save record over http")
			predicate: {text: "hello"}
			find_url: "http://localhost:5000?method=find&table=log"
			data = [predicate, log]
			rest.post(find_url, {data: JSON.stringify(data)}).addListener("complete", (data) ->
				assert.equal(data, JSON.stringify([log]), "should find record over http")
				server.close()
			)
		)


test_migration: ->
	
	db_file: "./test/test_migration.db"
	remove_file(db_file)
	
	#create schema 1
	db: nosqlite.open db_file,  ->
		log: {
			text: "hello",
			occurred_at: new Date(),
			created_at: new Date(),
			updated_at: new Date(),
			source: "string1",
			log_type: "string1",
			geo_lat: "string1",
			geo_long: "string1",
			metric:  5,
			external_id: 10,
			level: 5,
			readable_metric: "5 miles",
			facts: ["hello", "hello", "hello1"],
			original: {id: 1, text: "some crazy object"} 
		}
	
		convert_callback: (old_obj) ->
			old_obj.occurred_at: "you big dork"
			return old_obj
		
		db.save "log", log, false, (err, res) ->
			db.migrate_table "log", convert_callback, (err, res)->
				if err? then sys.p err
				assert.equal(res, "success", "should migrate table from one schema to another")

peer1: ->
	db_file: "./test/peer1.db"
	#remove_file db_file
	#start the listener
	db: nosqlite.open db_file, ->
		server: db.listen(5000)

peer2: ->
	db_file: "./test/peer2.db"
	#remove_file db_file
	#start the listener
	db: nosqlite.open db_file, ->
		server: db.listen(5001)
		
test_pull: ->
	db_file: "./test/peer2.db"
	remove_file db_file
	db: nosqlite.open db_file, ->
		db.add_remote "local1", "5000", "localhost", (err, res) ->
			db.pull "local1", (err, res) ->
				throw err if err?
				assert.equal(res, "success", "should pull all new commits from remote source")

test_pull_again: ->
	db_file: "./test/peer2.db"
	db: nosqlite.open db_file, ->
		db.pull "local1", (err, res) ->
			throw err if err?
			assert.equal(res, "success", "should pull all new commits from remote source")
	
test_add_remote: ->
	db_file: "./test/peer2.db"
	db: nosqlite.open db_file, ->
		db.add_remote "local1", "5000", "localhost", (err, res) ->
			if err? then throw err
		
# test_add_remote()
# test_save_bulk()
# peer1()
# peer2()
# test_pull()
# test_pull_again()
test_sync()
#test_find_or_save()
#test_save()
#test_update_object()
#test_fetch_commits()
#test_objects_since_commit()
#test_save_multiple()
#test_migration()
#test_save_web()