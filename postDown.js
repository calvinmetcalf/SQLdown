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
PostDown.prototype._put = function (key, rawvalue, cb) {
	var value = JSON.stringify(rawvalue);
 	pg.connect(self.location, function(err, client, done){
		if (err){
			return cb(err);
		}
		client.query({
			text: 'INSERT INTO postdown(key, value) VALUES($1, $2);',
			name: "insert values"
			values: [key, value]
		}, function (resp, e) {
			if(e){
				if (e.cause.code === "23505") {
					client.query({
						text: 'UPDATE postdown SET value=$2 WHERE key=$1;',
						name: "update values",
						values: [key, value]
					}, function(e){
						done();
						if(e){
							cb(e);
						}else{
							cb(null, true);
						}
					});
				} else {
					done();
					cb(e);
				}
			}else{
				done();
				cb(null, true);
			}
		});
  });
};