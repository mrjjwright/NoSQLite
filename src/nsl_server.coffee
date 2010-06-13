# NoSQLite http server functions
sys: require "sys"
require "underscore"
sqlite: require "sqlite"
sql: require "./sql"

# Web API
# --------------------------------------
# Starts a webserver on the supplied port to serve http requests
# for the instance's associated database.
# If NoSQLite has already started a webserver on that port
# this method returns silently. 
listen: (port, host) ->
	port: 5000 if not port?
	http: require "http" if not http?
	self: this	
	server: http.createServer( (request, response) ->
		sys.debug("NoSQLite received request")
		body: ""
		url: require("url").parse(request.url, true)
		if not url.query?  or not url.query.method?
			response.writeHead(500, {"Content-Type": "text/plain"})
			response.write("Must supply method param")
			response.end();
			return
		table: url.query.table
		# Parse the url to see what the user wants to do
		request.setBodyEncoding('utf8');
		request.addListener "data", (data) ->
			body += data
		request.addListener "end", ->
			body_obj: {}
			
			parse_body: ->
				try
					return JSON.parse(body)
				catch error
					self.write_res(response, new Error("Unable to parse HTTP body as JSON.  Make sure it is valid JSON.  Error: " + error.message))
									
			try
				switch url.query.nsl_method
					when "fetch" 
						remote_head: url.query.remote_head
						sys.debug("remote_head: " + typeof remote_head) 
						if not table?
							self.fetch_commits remote_head, (err, result) ->
								self.write_res(response, err, result)
					when "save" 
						body_obj: parse_body()
						self.save(table, body_obj, false, (err, result) ->
							self.write_res(response, err, result)
						 )
					when "find" 
						predicate: JSON.parse(body)
						if predicate.records?
							# The client is sending some records to save along with asking for new records
							# This is for convenience for clients that want to do a simple sync in one http call
							records_to_save: predicate.records
							predicate: predicate.predicate
							self.save table, records_to_save, (err, result) ->
								if err? then return self.write_res(response, err)
								self.find table, predicate, (err, result) ->
									self.write_res(response, err, result)
						else
							self.find table, predicate, (err, result) ->
								self.write_res(response, err, result)
						 
					when "find_or_save" 
						args: JSON.parse(body)
						self.find_or_save(table, args[0], args[1], (err, result) ->
							self.write_res(response, err, result)
						 )
					else
						response.writeHead(500, {"Content-Type": "text/plain"})
						response.write("Unrecognized method: ${url.query.method}")
						response.end();
			catch err
				self.write_res(response, err, null)
	 )
	server.listen(port, host)
	return server	

write_res: (response, err, result) ->
	if err?
		response.writeHead(500, {"Content-Type": "text/plain"})
		response.write(err.message)
	else
		response.writeHead(200, {"Content-Type": "text/plain"})
		response.write(JSON.stringify(result))											
	response.end();

exports.listen: listen
