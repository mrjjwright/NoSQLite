# An abstract class used to specify the NoSQLite interface to SQLite
#
# This class should never be instantiated or even used,
# It's here as a reference.
# NoSQLite runs on node.js, the browser, and on the iPhone/iPad
# all of which interface to SQLite a bit differently.
# The asynchronous HTML5 web database API was chosen as a standard for all 3
# since it was the most restrictive.
# See: http://dev.w3.org/html5/webdatabase/

class HTMLWebDB
	
	# Opens the database 
	# Implementors can take the name to be the complete path to the db if it makes sense
	# Also implementors can ignore the version attribute
	openDatabase: (name, version, displayName, estimatedSize, callback) ->
		throw new Error("abstract")
	
	# Should begin an transaction
	# Any errors thrown should not terminate the transaction
	transaction: (start, failure, success) ->
		throw new Error("abstract")
		
	# Executes a sql, with the supplied bindings
	#
	# Implemtorshould cache all statements and re-use them if possible.
	# sql can either be an escaped sql, or sql with ? placeholders.
	# optional bindings is an array of params in the right order
	# optional callback(transaction, resultSet) 
	# optional errorCallback(transaction,error) 
	executeSQL: (sql, bindings, callback, errorCallback) ->
		throw new Error("abstract")
		
	
	