SQLdown [![Build Status](https://travis-ci.org/calvinmetcalf/SQLdown.svg)](https://travis-ci.org/calvinmetcalf/SQLdown)
====

A levelup backend with knex (sqlite3, postgres, and mysql tested and websql possible).

```bash
npm install --save sqldown
```

Also it doesn't come with any of the database backends so you need to install those yourself, one of

```bash
npm install --save sqlite3
npm install --save pg pg-query-stream
npm install --save mysql
```

In node locations should be connection strings (e.g. `postgres://username:password@localhost/database`), if it doesn't start with a 'dbType://' it is assumed to be the path for a local sqlite3 database.  Table defaults to sqldown but can be overridden either by passing an `table` option or setting a query param (`pg://localhost/database?table=tablename`).

In the browser location will always be the table name.

Test setup and much else taken from [level-js](https://github.com/maxogden/level.js).

## Setup

To get around the fact that postgres does not feature upserts instead of a simple table with 2 columns, `key` and `value` with `key` being the primary and unique key, instead we have a more complex setup with 3 columns `id`, `key` and `value` with `id` being an auto-incremented integer. When we `get` we query for the value with the given key which has the highest id.

This could lead to much excess data if you were to update the same key a bunch so it's set to periodically (by default every 25 puts) clean up any entries that aren't the max id for a given key.

Databases that support indexes on arbitrarily long fields have the `key` field index.  If you know your keys or values are going to be shorter then a given length you may specify `keyLength` or `valueLength` option to limit it to that length, this is a prerequisite for mysql indexes.
