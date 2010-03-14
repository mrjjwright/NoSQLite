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

See the [nosqlite test](http://github.com/mrjjwright/NoSQLite/blob/master/test/test_nosqlite.coffee) for now 

Currently Requires
----------------

* [node](http://nodejs.org)
* [CoffeeScript](http://jashkenas.github.com/coffee-script/) - fun, clean way to write JavaScript.  Includes Cake to run the Cakefile and tests.
* [node-sqlite](http://github.com/grumdrig/node-sqlite) -  I am working on rewriting this to be async and be more HTML 5 compatible.  You will have to get it and compile the node bindings and put it in your node require path
