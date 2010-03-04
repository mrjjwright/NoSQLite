NoSQLite
============

The beauty of SQLite is that it is very flexible.  The beauty of Javascript is that it is very flexible.

The goal of NoSQLite is to exploit that even more than other SQLite libraries.

* zero-config - No "create table", "alter table".
* zero-schema - Just store my JS object in an intelligent way.
* simple DSL - just find stuff, save stuff, or find_or_save stuff (ok remove stuff too).

Other goals
_________

* Be HTML 5 compatible
* Support full text search.
* Support anything that makes it easier to practically work with SQLite

Currently Requires
----------------

* [node](http://nodejs.org)
* [node-sqlite](http://github.com/grumdrig/node-sqlite) -  I am working on rewriting this to be async and be more HTML 5 compatible.

