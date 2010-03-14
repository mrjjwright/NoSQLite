NoSQLite - SQLite for Javascript
-------------------------------

The beauty of SQLite is that it is very flexible.  The beauty of Javascript is that it is very flexible.

The goal of NoSQLite is to exploit that even more than other SQLite libraries.

* zero-config - No "create table", "alter table".
* zero-schema - Just store my JS object in an intelligent way.
* zero-SQL - just a simple DSL to find stuff, save stuff, or find_or_save stuff (ok remove stuff too).

Other goals
---------------

* Support full text search.
* Support anything that makes it easier to practically work with SQLite
* Maybe...Be HTML 5 compatible
* Working on...Core Data compatibility, see the core_data_mode branch.

How to use
-------------------

First make sure you have an HTML5 compatible sqlite driver.  [Node-sql](http://github.com/mrjjwright/node-sqlite) is what I (mrjjwright) use and is the only one tested with NoSQLite at the moment.

Add necessary requires (examples are shown in CoffeeScript):
	
	sqlite: require("node-sqlite")
	nosql: require("nosqlite")

Open up a reference to your database and pass it to NoSQLite
	
	db: nosqlite.connect(sqlite.openDatabaseSync("my_db.sqlite3"))

Now you are ready to start working with nosqlite

	db.save("foo", {x: 4, y: 5})
	
This creates a table called foo if it doesn't exist with 2 columns, x and y.  To read these out:

	db.find("foo", {x: 1}, (err, res) ->
		foo: res
	)
	

You can also save multiple objects in an array

	db.save("foo", [{x: 1, y: 2}, {x: 3, y: 4}])
	
You can find stuff with predicates

	db.find("foo", {"x <=": 5}, (err, results) ->
		puts results.length
		# prints 3
	)
	
You can add new attributes
	
	foo.z = 6
	db.save("foo", foo)
	#adds a column to your db called z
	
A common metaphor when I work with SQLite is to insert some records in the db if they don't already exist.  Of course unique keys can help with this but sometimes they are not available so I added this convenience function

	objs: [{x: 5, y: 2}, {x: 17, y: 20}]
	db.find_or_save("foo", {x: 1}, objs,  (err, results) ->
		#saves the first object, inserts the second
		puts results.size
		# prints 1
	)
	
The above function applies the form of the predicate to each member of the array (you can use a single object as well).  It then tries to find each object in the array and return it in the results.  If it doesn't find it, NoSQLite will call an "insert or replace" SQLite function on each object.  As usual if any tables or columns don't exist they will be dynamically created.

	

See the [nosqlite tests](http://github.com/mrjjwright/NoSQLite/blob/master/test/test_nosqlite.coffee) for more info as well as the [docco](http://jashkenas.github.com/docco/) styled docs in the docs directory. 

Currently Requires
----------------

* [node](http://nodejs.org)
* [CoffeeScript](http://jashkenas.github.com/coffee-script/) - fun, clean way to write JavaScript.  Includes Cake to run the Cakefile and tests.
* [node-sqlite](http://github.com/grumdrig/node-sqlite) or another HTML5 compatible database -  I am working on rewriting this to be async and be more HTML 5 compatible.  You will have to get it and compile the node bindings and put it in your node require path
