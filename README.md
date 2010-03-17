NoSQLite - SQLite for Javascript
-------------------------------

The beauty of SQLite is that it is very flexible.  The beauty of Javascript is that it is very flexible.

The goal of NoSQLite is to exploit that even more than other SQLite libraries.

* zero-config - No "create table", "alter table".
* zero-schema - Just store my JS object in an intelligent way.
* zero-SQL - just a simple DSL to find stuff, save stuff, or find_or_save stuff (ok remove stuff too).

Other goals
---------------

* (`core_data_mode` branch) Core Data compatibility so you can work easily with iPhone and Cocoa databases.
* (coming) Support syncing 2 copies of a SQLite database (even if one is in Core Data format and even if one is remote, via the web listener interface).
* (maybe) Support full text search.
* (maybe) Be fully HTML 5 compatible.  I need help with this for those people who want this in the browser.
* Support anything that makes common uses cases with SQLite easier.

How to use
-------------------

Put `nosqlite.js` and `sql.js` in your node.requires path. 

You will also need an HTML5 compatible sqlite driver.  [Node-sql](http://github.com/mrjjwright/node-sqlite) is what I (mrjjwright) use and is the only one tested with NoSQLite at the moment.  If you want to use it, download it, compile it for node and put it in the node.requires. path.

Add necessary requires to the top of your JS (examples are shown in CoffeeScript):
	
	sqlite: require("node-sqlite")
	nosql: require("nosqlite")

Open up a reference to your database and pass it to NoSQLite
	
	db: nosqlite.connect(sqlite.openDatabaseSync("my_db.sqlite3"))

Now you are ready to start working with NoSQLite.  NoSQLite is motivated by the idea that if we work simply with a one-to-one mapping between a JS object and a SQLite table (no joins), we can get an awful lot for free, and better querying capabilities than other NoSQL stores out there.

	db.save("foo", {x: 4, y: 5})
	
This creates a table called foo if it doesn't exist with 2 columns, x and y.  To read this object out:

	db.find("foo", {x: 4}, (err, res) ->
		foo: res
	)
	
You can also save multiple objects in an array:

	db.save("foo", [{x: 1, y: 2}, {x: 3, y: 4}])
	
You can find using predicates:

	db.find("foo", {"x <=": 5}, (err, results) ->
		puts results.length
		# prints 3
	)
	
You can add new attributes:
	
	foo.z = 6
	db.save("foo", foo)
	#adds a column to your db called z
	
A common metaphor when I work with SQLite is to insert some records in the db if they don't already exist.  Of course unique keys can help with this but sometimes they are not available so I added this convenience function:

	objs: [{x: 5, y: 2}, {x: 17, y: 20}]
	db.find_or_save("foo", {x: 1}, objs,  (err, results) ->
		#saves the first object, inserts the second
		puts results.size
		# prints 1
	)
	
The above function applies the form of the predicate to each member of the array (the actual value of the predicate passed doesn't matter and you can use a single object as well).  It then tries to find each object in the array and return it in the results.  If it doesn't find it, NoSQLite will call an "insert or replace" SQLite function on each object.  As usual if any tables or columns don't exist they will be dynamically created.

	
See the [nosqlite tests](http://github.com/mrjjwright/NoSQLite/blob/master/test/test_nosqlite.coffee) for more info as well as the [docco](http://jashkenas.github.com/docco/) styled docs in the docs directory. 

Options object
=======================================

You can pass as options object to nosqlite like so:

	options: {no_guid: true}
	db: nosqlite.connect(sqlite.openDatabaseSync(db_file), options)

Here are the options supported

* __no_guid__ - By default NoSQLite will generate a unique UUID and add it to a column named `guid` with a unique constraint.  This is for syncing 2 SQLite databases.  If you don't want this pass false for this option.
* __core_data_mode__ -By default this is false but if set to true, NoSQLite will generate all SQL with core data like schema compatibility.  This isn't fully tested yet but will be more as my personal project starts to work with Core Data more.  There are a few tests in `test_sql.js` that you can take a look at.


Web mode
========================

You can start nosqlite in web mode by executing

    db.listen(5000, host)

where db is an instance of NoSQLite obtained via the `connect` method.  This only works with NoSQLite running in node and will cause node to start a simple node based http server to service requests.   The port and host are optional.  The port defaults to 5000 and host defaults to "127.0.0.1".  

Here is how to use the web API.

The API only reads query params and the HTTP post body so you can map it to any url you want to.

Global Query Params
-----------------------

* __table__ - The table name in SQLite.  The NoSQLite API is oriented around one table per object, so you will always be dealing with one table.

* __method__ - The method on NoSQLite to call.  One of `find`, `save`, or `find_or_save_all``. 


Web API Methods
-----------------------

* __save__ - `?table=foo&method=save` - Pass the record to be saved as JSON in the body.  Returns back either a string "success" or an error message.
* __find__ - `?table=foo&method=find` - Pass the predicate as a JSON string in the body.  Returns back either an array of found results in JSON format.
* __find_or_save__ - `?table=foo&method=find_or_save` - Pass an array with 2 elements.  The first is the predicate, and the second the obj or objects to save if not found.  Returns back either an array of found results in JSON format or the string "success".

See the [nosqlite tests](http://github.com/mrjjwright/NoSQLite/blob/master/test/test_nosqlite.coffee) for an example.

Currently Requires
========================

* [node](http://nodejs.org)
* [CoffeeScript](http://jashkenas.github.com/coffee-script/) - fun, clean way to write JavaScript.  Includes Cake to run the Cakefile and tests.
* [node-sqlite](http://github.com/grumdrig/node-sqlite) or another HTML5 compatible database -  I am working on rewriting this to be async and be more HTML 5 compatible.  You will have to get it and compile the node bindings and put it in your node require path
* [restler](http://github.com/danwrong/restler) - only needed to execute the tests for web API.  Not needed otherwise.
