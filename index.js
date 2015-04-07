'use strict';
var inherits = require('inherits');
var knex = require('knex');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var Iter = require('./iterator');
var fs = require('fs');
var Promise = require('bluebird');
var url = require('url');
var TABLENAME = 'sqldown';
module.exports = SQLdown;
function parseConnectionString(string) {
  if (process.browser) {
    return {
      client: 'websql'
    };
  }
  var parsed = url.parse(string);
  var protocol = parsed.protocol;
  if(protocol === null) {
    return {
      client:'sqlite3',
      connection: {
        filename: string
      }
    };
  }
  if (protocol.slice(-1) === ':') {
    protocol = protocol.slice(0, -1);
  }
  return {
    client: protocol,
    connection: fixDB(parsed)
  };
}
function fixDB(parsed) {
  var out = {};
  var db = parsed.pathname;
  if (db[0] === '/') {
    db = db.slice(1);
  }
  out.database = db;
  if (parsed.hostname) {
    out.host = parsed.hostname;
  }
  if (parsed.port) {
    out.port = parsed.port;
  }
  if (parsed.auth) {
    var idx = parsed.auth.indexOf(':');
    if (~idx) {
      out.user = parsed.auth.slice(0, idx);
      if (idx < parsed.auth.length - 1) {
        out.password = parsed.auth.slice(idx + 1);
      }
    }
  }
  return out;
}
function getTableName (location, options) {
  if (process.browser) {
    return location;
  }
  var parsed = url.parse(location, true).query;
  return parsed.table || options.table || TABLENAME;
}
// constructor, passes through the 'location' argument to the AbstractLevelDOWN constructor
// our new prototype inherits from AbstractLevelDOWN
inherits(SQLdown, AbstractLevelDOWN);

function SQLdown(location) {
  if (!(this instanceof SQLdown)) {
    return new SQLdown(location);
  }
  AbstractLevelDOWN.call(this, location);
  this.knexDb = this.counter = this.dbType = this.compactFreq = this.tablename = void 0;
  this._paused = false;
}
SQLdown.destroy = function (location, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  var conn = parseConnectionString(location);
  if (conn.client === 'sqlite3') {
    fs.unlink(location, callback);
    return;
  }
  var db = knex(conn);
  db.schema.dropTableIfExists(getTableName(location, options)).then(function () {
    return db.destroy();
  }).exec(callback);
};


SQLdown.prototype._open = function (options, callback) {
  var self = this;
  var conn = parseConnectionString(this.location);
  this.dbType = conn.client;
  this.knexDb = knex(conn);
  this.tablename = getTableName(this.location, options);
  this.compactFreq = options.compactFrequency || 25;
  this.counter = 0;
  function createTable() {
    return self.knexDb.schema.createTable(self.tablename, function (table) {
      table.increments('id').primary();
      if (options.keySize){
        table.string('key', options.keySize).index();
      } else if(self.dbType === 'mysql') {
        table.text('key');  
      } else {
        table.text('key').index();
      }
        
      if (options.valueSize){
        table.string('value', options.valueSize);
      } else {
        table.text('value');  
      }
    });
  }
  if (process.browser){
    this.knexDb.select('id').from(this.tablename).limit(1).catch(function (){
      return createTable();
    }).nodeify(callback);
  } else {
    self.knexDb.schema.hasTable(self.tablename).then(function (has) {
      if (!has) {
        return createTable();
      }
    }).nodeify(callback);
  }
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
  this.knexDb.select('value').from(this.tablename).whereIn('id', function (){
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
        if(value.type === 'Buffer'){
          value = new Buffer(value.data);
        }else{
          value = new Buffer(value);
        }
      }
      cb(null, value);
    } catch (e) {
      cb(new Error('NotFound'));
    }
  });
};

SQLdown.prototype._put = function (key, rawvalue, opt, cb) {
  var self = this;
  if (!this._isBuffer(rawvalue) && process.browser  && typeof rawvalue !== 'object') {
    rawvalue = String(rawvalue);
  }
  var value = JSON.stringify(rawvalue);
  self.pause(function () {
    self.knexDb(self.tablename).insert({
      key: key,
      value:value
    }).then(function () {
      return self.maybeCompact();
    }).nodeify(cb);
  });
};

SQLdown.prototype._del = function (key, opt, cb) {
  var self = this;
  this.pause(function () {
    self.knexDb(self.tablename).where({key: key}).delete().exec(cb);
  });
};
function unique(array) {
  var things = {};
  array.forEach(function (item) {
    things[item.key] = item;
  });
  return Object.keys(things).map(function (key) {
    return things[key];
  });
}
SQLdown.prototype._batch = function (array, options, callback) {
  var self = this;
  var inserts = 0;
  this.pause(function () {
    self.knexDb.transaction(function (trx) {
      return Promise.all(unique(array).map(function (item) {
        if (item.type === 'del') {
          return trx.where({key: item.key}).from(self.tablename).delete();
        } else {
          inserts++;
          return trx.insert({
            key: item.key,
            value:JSON.stringify(item.value)
          }).into(self.tablename);
        }
      }));
    }).then(function () {
      return self.maybeCompact(inserts);
    }).nodeify(callback);
  });
};
SQLdown.prototype.compact = function () {
  var self = this;
  return this.knexDb(this.tablename).select('key','value').not.whereIn('id', function () {
    this.select('id').from(function () {
      this.select(self.knexDb.raw('max(id) as id')).from(self.tablename).groupBy('key').as('__tmp__table');
    });
  }).delete();
};

SQLdown.prototype.maybeCompact = function (inserts) {
  if (inserts + this.counter > this.compactFreq) {
    this.counter += inserts;
    this.counter %= this.compactFreq;
    return this.compact();
  }
  this.counter++;
  this.counter %= this.compactFreq;
  if (this.counter) {
    return Promise.resolve();
  } else {
    return this.compact();
  }
};

SQLdown.prototype._close = function (callback) {
  var self = this;
  process.nextTick(function () {
    self.knexDb.destroy().exec(callback);
  });
};
SQLdown.prototype.pause = function (cb) {
  if (!this._paused) {
    cb();
  } else {
    this.knexDb.once('unpaused', cb);
  }
};
SQLdown.prototype.iterator = function (options) {
  var self = this;
  this._paused = true;
  return new Iter(this, options, function () {
    self._paused = false;
    self.knexDb.emit('unpaused');
  });
};
