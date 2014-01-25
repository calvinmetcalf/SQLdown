var util = require('util');
var AbstractLevelDOWN = require('./').AbstractLevelDOWN;
var pg = require('pg.js');
function openDB() {
  if (typeof global !== 'undefined') {
    if (global.navigator && global.navigator.sqlitePlugin && global.navigator.sqlitePlugin.openDatabase) {
      return navigator.sqlitePlugin.openDatabase.apply(navigator.sqlitePlugin, arguments);
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return global.sqlitePlugin.openDatabase.apply(global.sqlitePlugin, arguments);
    } else {
      return global.openDatabase.apply(global, arguments);
    }
  }
}
// constructor, passes through the 'location' argument to the AbstractLevelDOWN constructor
function WebSQLDOWN (location) {
  AbstractLevelDOWN.call(this, location);

}

// our new prototype inherits from AbstractLevelDOWN
util.inherits(WebSQLDOWN, AbstractLevelDOWN);

WebSQLDOWN.prototype._open = function (options, callback) {
	var self = this;
	this.version = options.version || 1;
	this.size = options.size || (5 * 1024 * 1024);
	this.db = openDatabase(this.location, this.vesion, this.location, this.size);
	if(!this.db){
		return callback(true);
	}
	this.db.transaction(function (tx) {
		 tx.executeSql('CREATE TABLE IF NOT EXISTS webdown (key text PRIMARY KEY, value);', function(tx,msg){
		 		callback(null,msg);
		 },function(tx,err){
		 	callback(err);
		 });
	});
};

WebSQLDOWN.prototype._get = function(key, opt, cb) {
	var self = this;
	var sql = "SELECT value FROM webdown WHERE key=?"
	this.db.transaction(function (tx) {
		tx.executeSql(sql, [key], function(tx, res){
			try{
				cb(null, JSON.parse(res.rows[0].value));
			}catch(e){
				cb(e);
			}
		},function(tx,err){
		 	cb(err);
		 });
	});
}
WebSQLDOWN.prototype._put = function (key, rawvalue, opt, cb) {
	var value = JSON.stringify(rawvalue);
	var sql =  'INSERT OR REPLACE INTO postdown(key, value) VALUES(?, ?);';
 	this.db.transaction(function (tx) {
		tx.executeSql(sql, [key, value], function(txt, msg){
			cb(null, msg);
		}, function(tx,err){
		 	cb(err);
		 });
  });
};
WebSQLDOWN.prototype._del = function(key, opt, cb) {
	var self = this;
	var sql = "DELETE FROM webdown WHERE key=?"
	this.db.transaction(function (tx) {
		tx.executeSql(sql, [key], function(tx, res){
			cb(null, res);
		},function(tx,err){
		 	cb(err);
		 });
	});
}
module.exports = WebSQLDOWN;