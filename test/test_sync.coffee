require.paths.unshift "vendor"
sys: require "sys"
nosqlite: require("../lib/index")
fs: require "fs"
flow: require "flow"
assert: require "assert"


remove_file: (file) ->
	try
		fs.unlinkSync(file)
	catch err
		sys.puts err

test_pull: ->
	db_file: "./test/test_pull.db"
	#remove_file(db_file)
	
	db: nosqlite.open db_file, {sync_mode: true},  ->
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
		
		log_desc: {
			table: "log"
			objs: [log]
		}
		
		#create a schema
		schema: [
			{
				table: "log"
				objs: [log]
			}
		]

		flow.exec(
			->
				db.create_schema(schema, this)
			(err) ->
				if err? then throw err
				db.pull "http://localhost:3000/nsl/pull", "test_sync.db", this
			(err, results) ->
				if err? then throw err
		)

test_pull()