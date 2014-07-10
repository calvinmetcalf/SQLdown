'use strict';
var inherits = require('inherits');
var knex = require('knex');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var Iter = require('./iterator');
var fs = require('fs');
var Promise = require('bluebird');
module.exports = SQLdown;
// constructor, passes through the 'location' argument to the AbstractLevelDOWN constructor
function SQLdown(location) {
  if (!(this instanceof SQLdown)) {
    return new SQLdown(location);
  }
  AbstractLevelDOWN.call(this, location);
}
SQLdown.destroy = function (location, callback) {
  fs.unlink(location, callback);
};

var TABLENAME = 'sqldown';
// our new prototype inherits from AbstractLevelDOWN
inherits(SQLdown, AbstractLevelDOWN);

SQLdown.prototype._open = function (options, callback) {
  var self = this;
  this.db = knex({
    client: options.client || 'sqlite3',
    connection: {
      filename: this.location
    }
  });
  this.tablename = options.tablename || TABLENAME;
  this.db.schema.hasTable(this.tablename).then(function (exists) {
      if (!exists) {
        return self.db.schema.createTable(self.tablename, function (table) {
          table.increments('id').primary();
          table.text('key');
          table.text('value');
        });
      }
    })
    .nodeify(callback);
};

SQLdown.prototype._get = function (key, options, cb) {
  var self = this;
  var asBuffer = true;
  if (options.asBuffer === false) {
    asBuffer = false;
  }
  if (options.raw) {
    asBuffer = false;
  }
  this.db.select('value').from(this.tablename).whereIn('id', function (){
    this.max('id').from(self.tablename).where({key:key});
  }).exec(function (err, res) {
    if (err) {
      return cb(err.stack);
    }
    if (!res.length) {
      return cb(new Error('NotFound'));
    }
    try {
      var value = JSON.parse(res[0].value);
      if (asBuffer) {
        value = new Buffer(value);
      }
      cb(null, value);
    } catch (e) {
      cb(new Error('NotFound'));
    }
  });
};
SQLdown.prototype._put = function (key, rawvalue, opt, cb) {
	var value = JSON.stringify(rawvalue);
  this.db(this.tablename).insert({
    key: key,
    value:value
  }).exec(cb);
};
SQLdown.prototype._del = function (key, opt, cb) {
  this.db(this.tablename).where({key: key}).delete().exec(cb);
};
SQLdown.prototype._batch = function (array, options, callback) {
  var self = this;
  this.db.transaction(function (trx) {
    return Promise.all(array.map(function (item) {
      if (item.type === 'del') {
        return self.db(self.tablename).transacting(trx).where({key: item.key}).delete();
      } else {
        return trx.insert({
          key: item.key,
          value:JSON.stringify(item.value)
        }).into(self.tablename);
      }
    }));
  }).nodeify(callback);
};
SQLdown.prototype._close = function (callback) {
  this.db.destroy().exec(callback);
};

SQLdown.prototype.iterator = function (options) {
  return new Iter(this, options);
};
