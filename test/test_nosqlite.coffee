nosqlite: require "./nosqlite"
sqlite: require "./sqlite"

remove_file: (file) ->
	try
		fs.unlinkSync(file)
	catch err
		puts err
	

test_find: ->
	db_file: "./test/test_find.db"
	remove_file(db_file)

	db1: nosqlite.connect(sqlite.openDatabaseSync(db_file))
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

	db1.save("log", log, (res) ->
		db1.find("log", {text: "hello"}, (err, result) ->
			ok(result[0].text, "hello", "should find single object")
			#db.close()
		)
	)

test_save_cd: ->
	db_file: "./test/test_save_cd.db"
	remove_file(db_file)

	db: nosqlite.connect(sqlite.openDatabaseSync(db_file), true)
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
		puts res
		ok(res, "success", "should save single obj")
	)


test_save: ->
	db_file: "./test/test_save.db"
	remove_file(db_file)
	
	db: nosqlite.connect(sqlite.openDatabaseSync(db_file))
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
		puts res
		ok(res, "success", "should save single obj")
	)
	
test_save_multiple: ->
	db_file: "./test/test_save_multiple.db"
	remove_file(db_file)
	
	db: nosqlite.connect(db_file)
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
	

	db.save("log", logs, (res) ->
		ok(res, "success", "should save multiple obj")
		db.close()
	)

	
test_save_bulk: ->
	db_file: "./test/test_save_bulk.db"
	#remove_file(db_file)
	db: nosqlite.connect(db_file)
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
	for i in [1..250000]
		logs.push(_.clone(log))
	
	db.save("log", logs, (err, res) ->
		ok(res, "success", "should save 25,000 log messages quickly")
		db.close()
	)


test_find_or_save: ->
	db_file: "./test/test_find_or_save.db"
	remove_file(db_file)

	db: nosqlite.connect(db_file)
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
		ok(res, 2, "should save not find these obj")
		db.close()
	)
test_save_cd()