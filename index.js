var inherits = require('util').inherits;
var sqlite3 = require('sqlite3');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var fs = require('fs');
module.exports = SQLdown;
// constructor, passes through the 'location' argument to the AbstractLevelDOWN constructor
function SQLdown (location) {
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
      self.getStatement = self.db.prepare(GET);
      self.putStatement = self.db.prepare(PUT);
      self.delStatement = self.db.prepare(DEL);
      callback();
    });
  });
};

SQLdown.prototype._get = function(key, options, cb) {
   var asBuffer = true
  if (options.asBuffer === false) asBuffer = false
  if (options.raw) asBuffer = false
  this.getStatement.get([key], function (err, res){
    if (err){
      return cb(err);
    }
    try{
        var value = JSON.parse(res.value);
        if (asBuffer) {
          value = new Buffer(value)
        }
        cb(null, value);
      }catch(e){
        cb(new Error('NotFound'));
      }
  });
}
SQLdown.prototype._put = function (key, rawvalue, opt, cb) {
	var value = JSON.stringify(rawvalue);
  this.putStatement.run([key, value], cb);
};
SQLdown.prototype._del = function (key, opt, cb) {
  this.delStatement.run([key], cb);
};

SQLdown.prototype._close = function (callback) {
  this.db.close(callback);
}
