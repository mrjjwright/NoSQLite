# This is the Connect app definition file for the sync module of NoSQLite
# See: http://github.com/extjs/Connect
# This should be plugged into the NoSQLite Connect app server configuration
nosqlite: require("./index")
sys: require "sys"
flow: require "flow"
require "underscore"

errorHandler: (err, req, res, next) ->
	res.writeHead(200, { 'Content-Type': 'text/plain' })
	res.end(JSON.stringify(err))

nsl_req: {}
nsl_res: {}
db: {}

module.exports: require('connect').createServer([
	{ 
		module: {
			handle: (req, res, next) ->
				req.body: ''
				req.setEncoding('utf8')
				req.addListener 'data', (chunk) ->
					req.body += chunk
				 
				req.addListener 'end', ->
					try
						nsl_req: JSON.parse(req.body)
					catch err
						return next(new Error("Invalid JSON in body"))
					if not nsl_req.db?
						return next(new Error("Missing db name"))
					
					db_file: "./test/${nsl_req.db}"
					nsl_res: {
						objs: []
						gimme: []
					}
					db: nosqlite.open db_file, {sync_mode: true},  (err, db) ->
						return next(err) if err?
						return next()
						
			handleError: errorHandler
		} 
		route: '/nsl' 
	}
	{ 
		module: {
			handle: (req, res, next) ->
				db.pull_response nsl_req, nsl_res, (err) ->
					return next(err) if err?
					return next()

			handleError: errorHandler
		}
		route: '/nsl/pull'
	}
	{ 
		module: {
			handle: (req, res, next) ->
				db.push_response nsl_req, nsl_res, (err) ->
					return next(err) if err?
					return next()

			handleError: errorHandler
		}
		route: "/nsl/push"
	}
	{ 
		module: {
			handle: (req, res, next) ->
				nsl_res.objs: _.flatten(nsl_res.objs)
				nsl_res.gimme: _.flatten(nsl_res.gimme)
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify(nsl_res))

			handleError: errorHandler
		}
		route: "/nsl"
	}
])
