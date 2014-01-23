var util = require('util');
var AbstractLevelDOWN = require('./').AbstractLevelDOWN;
var pg = require('pg.js');

// constructor, passes through the 'location' argument to the AbstractLevelDOWN constructor
function PostDown (location) {
  AbstractLevelDOWN.call(this, location)
}

// our new prototype inherits from AbstractLevelDOWN
util.inherits(PostDown, AbstractLevelDOWN);

PostDown.prototype._open = function (options, callback) {
	this.client = new pg.Client(this.location);
};

PostDown.prototype.createTable = function(cb) {
	var self = this;
	var sql = "CREATE TABLE postdown (key text PRIMARY KEY, value json);"
	pg.connect(self.location, function(err, client, done){
		if (err){
			return cb(err);
		}
		client.query(sql, function(err, rslt){
			done();
			if(err){
				cb(err);
			}else{
				cb(null, rslt);
			}
		});
	});
}
PostDown.prototype._get = function(key, cb) {
	var self = this;
	var sql = "SELECT value FROM postdown WHERE key=$1"
	pg.connect(self.location, function(err, client, done){
		if (err){
			return cb(err);
		}
		client.query({
			txt:sql,
			values:[key]
			name: "get values"
		}, function(err, resp){
			done();
			if (!err && resp.rowCount === 1) {
				cb(null, resp.rows[0].value);
			}else{
				cb(err||"no such value");
			}
		});
	});
}