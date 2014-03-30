var util = require('util');
var sqlite3 = reqiure('sqlite3');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;

// constructor, passes through the 'location' argument to the AbstractLevelDOWN constructor
function SQLdown (location) {
  AbstractLevelDOWN.call(this, location);
}

var CREATE = 'CREATE TABLE IF NOT EXISTS sqldown (key text PRIMARY KEY, value);';
var GET = 'SELECT value FROM sqldown WHERE key=?';
var PUT = 'INSERT OR REPLACE INTO sqldown(key, value) VALUES(?, ?);';
var DEL = 'DELETE FROM sqldown WHERE key=?';
// our new prototype inherits from AbstractLevelDOWN
util.inherits(SQLdown, AbstractLevelDOWN);

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
    });
  });
};

SQLdown.prototype._get = function(key, opt, cb) {
  this.getStatement.get([key], function (err, res){
    if (err){
      return cb(err);
    }
    try{
        cb(null, JSON.parse(res.rows[0].value));
      }catch(e){
        cb(e);
      }
  });
}
SQLdown.prototype._put = function (key, rawvalue, opt, cb) {
	var value = JSON.stringify(rawvalue);
  this.putStatement.run([key, value], cb);
};
SQLdown.prototype._del = function (key, rawvalue, opt, cb) {
  this.delStatement.run([key], cb);
};
module.exports = SQLdown;