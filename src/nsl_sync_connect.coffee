# This is the Connect app definition file for the sync module of NoSQLite
# See: http://github.com/extjs/Connect
# This should be plugged into the NoSQLite Connect app server configuration
nosqlite: require("../lib/nosqlite").nosqlite
sys: require "sys"

errorHandler: (err, req, res, next) ->
	res.writeHead(200, { 'Content-Type': 'text/plain' })
	res.end(JSON.stringify(err));

module.exports: require('connect').createServer([
	{ 
		module: {
			handle: (req, res, next) ->
				db_file: "./test/test_sync.db"
				response: {
					objs: []
					gimme: []
				}
				request: {
					type: "pull"
					objs: []
					gimme: []
				}
				db: nosqlite.open db_file, {sync_mode: true},  (err, db) ->
					return next(err) if err?
					db.pull_response request, response, (err) ->
						if err? then next(err)
						res.writeHead(200, { 'Content-Type': 'application/json' })
						res.end(JSON.stringify(response))
						
			handleError: errorHandler
		} 
		route: '/pull' 
	}
	{ 
		module: {
			handle: (req, res, next) ->
				res.writeHead(200, { 'Content-Type': 'text/plain' })
				res.end("It worked!")
			handleError: errorHandler
		}
	}
])
