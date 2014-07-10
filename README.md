SQLdown [![Build Status](https://travis-ci.org/calvinmetcalf/SQLdown.svg)](https://travis-ci.org/calvinmetcalf/SQLdown)
====

A levelup backend with knex (sqlite3, postgres, and mysql tested and websql possible).

```bash
npm install --save sqldown
```

Also it doens't come with any of the database backends so you need to install those yourself, one of

```bash
npm install --save sqlite3
npm install --save pg pg-query-stream
npm install --save mysql
```

In node locations should be connection strings (e.g. `postgres://username:password@localhost/database`), if it doesn't start with a 'dbType://' it is assumed to be the path for a local sqlite3 database.  Table defaults to sqldown but can be overridden either by passing an `table` option or setting a query param (`pg://localhost/database?table=tablename`).

In the browser location will always be the table name.

Test setup and much else taken from [level-js](https://github.com/maxogden/level.js).