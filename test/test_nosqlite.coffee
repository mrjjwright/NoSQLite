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
	options: {}
	options.core_data_mode: true
	db: nosqlite.connect(sqlite.openDatabaseSync(db_file), options)
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
	
	db: nosqlite.connect(sqlite.openDatabaseSync(db_file))
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
	

	db.save("log", logs, (err, res) ->
		ok(res, "success", "should save multiple obj")
		db.close()
	)

	
test_save_bulk: ->
	db_file: "./test/test_save_bulk.db"
	remove_file(db_file)
	options: {}
	options.add_guid: true
	db: nosqlite.connect(sqlite.openDatabaseSync(db_file), options)
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

	db: nosqlite.connect(sqlite.openDatabaseSync(db_file))
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


test_save_web: ->

	db_file: "./test/test_save_web.db"
	remove_file(db_file)
	rest: require "restler" if not rest?
	
	#start the listener
	db: nosqlite.connect(sqlite.openDatabaseSync(db_file))
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
	puts "Invoking ${url}"
	rest.post(url, {data: JSON.stringify(log)}).addListener("complete", (data) ->
		ok(data, "success,", "should save record over http")
		predicate: {text: "hello"}
		find_url: "http://localhost:5000?method=find&table=log"
		data = [predicate, log]
		rest.post(find_url, {data: JSON.stringify(data)}).addListener("complete", (data) ->
			ok(data, JSON.stringify([log]), "should find record over http")
			server.close()
		)
	)
		

test_save_bulk()