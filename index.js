'use strict';
var inherits = require('util').inherits;
var sqlite3 = require('sqlite3');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var SQLinter = require('./iterator');
var fs = require('fs');
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
var CREATE = 'CREATE TABLE IF NOT EXISTS sqldown (key text PRIMARY KEY, value);';
var GET = 'SELECT value FROM sqldown WHERE key=?';
var PUT = 'INSERT OR REPLACE INTO sqldown(key, value) VALUES(?, ?);';
var DEL = 'DELETE FROM sqldown WHERE key=?';
// our new prototype inherits from AbstractLevelDOWN
inherits(SQLdown, AbstractLevelDOWN);

SQLdown.prototype._open = function (options, callback) {
  var self = this;
  this.db = new sqlite3.Database(this.location, function (err) {
    if (err) {
      return callback(err);
    }
    self.db.run(CREATE, function (err) {
      if (err) {
        return callback(err);
      }
      // self.getStatement = self.db.prepare(GET);
      // self.putStatement = self.db.prepare(PUT);
      // self.delStatement = self.db.prepare(DEL);
      callback();
    });
  });
};

SQLdown.prototype._get = function (key, options, cb) {
  var asBuffer = true;
  if (options.asBuffer === false) {
    asBuffer = false;
  }
  if (options.raw) {
    asBuffer = false;
  }
  this.db.get(GET, [key], function (err, res) {
    if (err) {
      return cb(err);
    }
    try {
      var value = JSON.parse(res.value);
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
  this.db.run(PUT, [key, value], cb);
};
SQLdown.prototype._del = function (key, opt, cb) {
  this.db.run(DEL, [key], cb);
};
SQLdown.prototype._batch = function (array, options, callback) {
  var self = this;
  this.db.serialize(function () {
    self.db.run('BEGIN TRANSACTION');
    var i = -1;
    var len = array.length;
    var item, value, key, type;

    function errCallback(err) {
      if (err) {
        callback(err);
      }
    }
    while (++i < len) {
      item = array[i];
      key = item.key;
      type = item.type || 'put';
      if (type === 'put') {
        value = JSON.stringify(item.value);
        self.db.run(PUT, [key, value], errCallback);
      } else {
        self.db.run(DEL, [key], errCallback);
      }
    }
    self.db.run('COMMIT TRANSACTION', callback);
  });
};
SQLdown.prototype._close = function (callback) {
  this.db.close(callback);
};

SQLdown.prototype.iterator = function (options) {
  return new SQLinter(this, options);
};
