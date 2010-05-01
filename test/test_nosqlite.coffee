nosqlite: require "../nosqlite"
sqlite: require "../sqlite"
sys: require "sys"
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

	db: nosqlite.connect db_file, ->
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

		db.save("log", log,  (res) ->
			db.find("log", {text: "hello"}, (err, result) ->
				db.close(->
					assert.equal(result.text, "hello", "should find single object")
				)
			)
		)

test_save_cd: ->
	db_file: "./test/test_save_cd.db"
	remove_file(db_file)
	options: {}
	options.core_data_mode: true
	db: nosqlite.connect db_file, ->
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

	db: nosqlite.connect db_file, ->
		log: {
			text: "hello",
			created_at: new Date().getTime(),
		}

		db.save("log", log, false, (err, res) ->
			assert.equal(res.length, 1, "should save single obj")
			log: res[0]
			log.text: "hello1"
			db.save("log", log, false, (err, res) ->
				assert.equal(res.length, 1, "should update single obj by adding a neew")
				db.close()
			)
		)

test_save: ->
	db_file: "./test/test_save.db"
	remove_file(db_file)

	db: nosqlite.connect db_file, ->
		log: {
			text: "hello",
			created_at: new Date().getTime(),
		}

		db.save("log", log, false, (err, res) ->
			assert.equal(res, "success", "should save single obj")
			db.close()
		)
	
test_save_multiple: ->
	db_file: "./test/test_save_multiple.db"
	remove_file(db_file)
	
	db: nosqlite.connect db_file, ->
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
			assert.equal(res, "success", "should save multiple obj")
			db.close()
		)

	
test_save_bulk: ->
	db_file: "./test/test_save_bulk.db"
	remove_file(db_file)
	options: {}
	
	db: nosqlite.connect db_file, options, ->
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
	
		db.save("log", logs, false, (err, res) ->
			assert.equal(res, "success", "should save 250000 log messages quickly")
			db.close()
		)


test_find_or_save: ->
	db_file: "./test/test_find_or_save.db"
	remove_file(db_file)

	db: nosqlite.connect db_file, ->
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

	db_file: "./test/test_save_bulk.db"
	
	#start the listener
	db: nosqlite.connect db_file, ->
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
	
	db_file: "./test/test_save_bulk.db"
	options: {}
	#remove_file(db_file)
	
	#create schema 1
	db: nosqlite.connect db_file, options, ->
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
			old_obj.occurred_at: "Date.parse(old_obj.ocurred_at).getTime()"
			return old_obj
		
		db.save "log", log, false, (err, res) ->
			db.migrate_table "log", convert_callback, (err, res)->
				if err? then sys.p err
				assert.equal(res, "success", "should migrate table from one schema to another")

#test_find()
#test_find_or_save()
#test_save()
test_update_object()
#test_save_multiple()
#test_migration()
#test_save_bulk()
#test_save_web()