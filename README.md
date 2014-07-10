SQLdown [![Build Status](https://travis-ci.org/calvinmetcalf/SQLdown.svg)](https://travis-ci.org/calvinmetcalf/SQLdown)
====

A levelup backend with knex (sqlite3 and postgres tested, mysql and websql possible).


Locations should be connection strings (e.g. `postgres://username:password@localhost/database`), if it doesn't start with a 'dbType://' it is assumed to be the path for a local sqlite3 database.  Table defaults to sqldown but can be overridden either by passing an `table` option or setting a query param (`pg://localhost/database?table=tablename`).


Test setup and much else taken from [level-js](https://github.com/maxogden/level.js)