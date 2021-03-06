NoSQLite - SQLite for Javascript
-------------------------------

** I am brainstorming an exciting new direction for NoSQLite in this [gist](http://gist.github.com/384199).  Your feedback is needed and appreciated.  Warning what is below could become obsolete. **


The beauty of SQLite is that it is very flexible.  The beauty of Javascript is that it is very flexible.

The goal of NoSQLite is to exploit that even more than other SQLite libraries.

* zero-config - No "create table", "alter table".
* zero-schema - Just store my JS object in an intelligent way.
* zero-SQL - just a simple DSL to find stuff, save stuff, or find_or_save stuff (ok remove stuff too).

NoSQLite tries to as light and smart of a SQLite wrapper as possible by following SQLite best practices.  This includes:

* Always using prepared statements.
* Running inside a SQLite `begin transaction`, `commit` whenever it makes sense.
* Running everything in smart batches when possible, never using unnecessary memory.

I am constantly studying SQLite best practices and other implementations to see what I can pull over.  I use this library for a production app and need optimum SQLite performance.

Other goals
---------------

* (`core_data_mode` branch) Core Data compatibility so you can work easily with iPhone and Cocoa databases.
* (coming) Support syncing 2 copies of a SQLite database (even if one is in Core Data format and even if one is remote, via the web listener interface).
* (maybe) Support full text search.
* (maybe) Be fully HTML 5 compatible.  I need help with this for those people who want this in the browser.
* Support anything that makes common uses cases with SQLite easier.

How to use
-------------------

Put all the NoSQLite files together in one directory in your node.requires.path.

NoSQLite uses my fork (temporarily) of the new async [node-sqlite](http://github.com/mrjjwright/node-sqlite) and it is the only sqlite driver tested with NoSQLite at the moment.  You will need to download it, run `node-waf configure` and `node-waf build` and copy the `sqlite.js` and  `build/default/sqlite3_bindings.node` into the NoSQLite directory.

Add necessary requires to the top of your JS (examples are shown in CoffeeScript):
	
	nosqlite: require("nosqlite")

Open up a reference to your database and pass it to NoSQLite
	
	db: nosqlite.connect("/mypath/my_db.sqlite3",  ->
		#start your work in a callback
	)


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
	db: nosqlite.connect(db_file, options, callback)

Here are the options supported

* __no_guid__ - By default NoSQLite will generate a unique UUID and add it to a column named `guid` with a unique constraint.  This is for syncing 2 SQLite databases.  If you don't want this pass false for this option.
* __core_data_mode__ -By default this is false but if set to true, NoSQLite will generate all SQL with core data like schema compatibility.  This isn't fully tested yet but will be more as my personal project starts to work with Core Data more.  There are a few tests in `test_sql.js` that you can take a look at.


Simple Migration
======================================

You can run a simple and fast data migration on any table with NoSQLite.  You can use this to change the schema of the table, or migrate data to a new format.  Simply call:
	
    db.migrate_table("foo", convert_callback, callback)

where

* __param1__ - is the name of the table you want migrate
* __convert_callback__ - a function that will take a row from the old table and return back the new object for that row.
* __callback__ - a normal callback method `callback(err, res)` that will be called with a response of "success" when the migration completes.

The migration will call the convert callback once to get the schema correct for the new recreated table and then call it again for the every row in the temp table.  The migration is written to be fast, by using a temporary table, and never loading all the records into memory at once.  Instead it steps through each row in the temp table, calls the convert_callback, and then inserts the row in another db connection.  This has been tested with a 200,000 row table to run in 20 seconds with minimal memory used.  See the code and tests for more documentation.

Web mode
========================

You can start nosqlite in web mode by executing

    db.listen(5000, host)

where db is an instance of NoSQLite obtained via the `connect` method.  This only works with NoSQLite running in node and will cause node to start a simple node based http server to service requests.   The port and host are optional.  The port defaults to 5000 and host defaults to "127.0.0.1".  


Global Query Params
-----------------------

The API only reads query params and the HTTP post body so you can map it to any url you want to.  But you should pass these URL params:

* __table__ - The table name in SQLite.  The NoSQLite API is oriented around one table per object, so you will always be dealing with one table.
* __method__ - The method on NoSQLite to call.  One of `find`, `save`, or `find_or_save_all``. 


Web API Methods
-----------------------

Here are the different methods supported:

* __save__ - `?table=foo&method=save` - Pass the record to be saved as JSON in the body.  Returns back either a string "success" or an error message.
* __find__ - `?table=foo&method=find` - Pass the predicate as a JSON string in the body.  Returns back either an array of found results in JSON format.
* __find_or_save__ - `?table=foo&method=find_or_save` - Pass an array with 2 elements.  The first is the predicate, and the second the obj or objects to save if not found.  Returns back either an array of found results in JSON format or the string "success".

See the [nosqlite tests](http://github.com/mrjjwright/NoSQLite/blob/master/test/test_nosqlite.coffee) for an example.

Currently Requires
========================

* [node](http://nodejs.org)
* [node-sqlite](http://github.com/mrjjwright/nosqlite)  My fork of it. You will have to get it and compile the node bindings and put it in your node requires path.
* [CoffeeScript](http://jashkenas.github.com/coffee-script/) - You don't need this to use NoSQLite, only to test it. CoffeeScript is a fun, clean way to write JavaScript.  Includes Cake to run the Cakefile and tests.
* [restler](http://github.com/danwrong/restler) - only needed to execute the tests for web API.  Not needed otherwise.
* (NoSQLite ships with these libraries so you don't need to install these: [flow.js](http://github.com/willconant/flow-js), [underscore.js](http://documentcloud.github.com/underscore/), [Math.uuid.js](http://www.broofa.com/2008/09/javascript-uuid-function/)
