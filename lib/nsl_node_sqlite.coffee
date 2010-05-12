# A HTML5 web database wrapper around the Node SQLite class
#
# NoSQLite runs on node.js, the browser, and on the iPhone/iPad
# all of which interface to SQLite a bit differently.
# The asynchronous HTML5 web database API was chosen as a standard for all 3
# since it was the most restrictive.
# See: http://dev.w3.org/html5/webdatabase/
#
# All of these functions are attached to the NoSQLite object 
# so "this" will refer to NoSQLite 	
sqlite: require "sqlite"
sys: require "sys"

class NSLNodeSQLite
	openDatabase: (name, version, displayName, estimatedSize, callback) ->
		try
			@db: new sqlite.Database()
			@db.open name, (err) ->
				callback() if callback?
		catch err
			handleError(err)
			
class NSLNodeSQLiteDatabase		
		
	# Should begin an transaction
	# Any errors thrown should not terminate the transaction
	transaction: (start, failure, success) ->
		throw new Error("abstract")

	# Executes a sql, with the supplied bindings
	#
	# Implemtors should cache all statements and re-use them if possible.
	# sql can either be an escaped sql, or sql with ? placeholders.
	# optional bindings is an array of params in the right order
	# optional callback(transaction, resultSet) 
	# optional errorCallback(transaction,error) 
	executeSQL: (sql, bindings, callback, errorCallback) ->
		throw new Error("abstract")

if require? and exports?
	exports.nsl_node_sqlite: new NSLNodeSQLite()
	