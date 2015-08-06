'use strict';
var inherits = require('inherits');
var knex = require('knex');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var Iter = require('./iterator');
var fs = require('fs');
var Promise = require('bluebird');
var url = require('url');
var TABLENAME = 'sqldown';
var util = require('./encoding');
var debug = require('debug')('sqldown:main');
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
      client: 'sqlite3',
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
  this._paused = 0;
  this._compactable = true;
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
  }).asCallback(callback);
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
      if (process.browser) {
        if (typeof options.keySize === 'number') {
          table.string('key', options.keySize).index();
        } else {
          table.text('key').index();
        }
      } else if(self.dbType === 'mysql') {
        if (typeof options.keySize === 'number') {
          table.binary('key', options.keySize).index();
        } else {
          table.binary('key');
        }
      } else {
        table.binary('key').index();
      }
      if (process.browser) {
        if (typeof options.valueSize === 'number') {
          table.string('value', options.valueSize);
        } else {
          table.text('value');
        }
      } else if(self.dbType === 'mysql' && typeof options.valueSize === 'number') {
        table.binary('value', options.valueSize);
      } else {
        table.binary('value');
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
  key = util.encode(key);
  this.knexDb.select('value').from(this.tablename).whereIn('id', function (){
    this.max('id').from(self.tablename).where({ key: key});
  }).asCallback(function (err, res) {
    if (err) {
      return cb(err.stack);
    }
    if (!res.length) {
      return cb(new Error('NotFound'));
    }
    try {
      var value = res[0].value;
      if (value === undefined || value === null) {
        return cb(new Error('NotFound'));
      }
      cb(null, util.decode(value, asBuffer, true));
    } catch (e) {
      cb(new Error('NotFound'));
    }
  });
};
SQLdown.prototype._put = function (key, value, opt, cb) {
  var self = this;
  value = util.encode(value, true);
  key = util.encode(key);

  self.pause(function () {
    self.knexDb(self.tablename).insert({
      key: key,
      value: value
    }).then(function () {
      return self.maybeCompact();
    }).nodeify(cb);
  });
};
SQLdown.prototype._del = function (key, opt, cb) {
  var self = this;
  key = util.encode(key);
  debug('before del pause');
  this.pause(function () {
    debug('after del pause');
    self.knexDb(self.tablename).insert({key: key}).then(function () {
      return self.maybeCompact();
    }).nodeify(cb);
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
        var key = util.encode(item.key);

        if (item.type === 'del') {
          return trx.insert({
            key: key
          }).into(self.tablename);
        } else {
          var value = util.encode(item.value, true);
          inserts++;
          return trx.insert({
            key: key,
            value: value
          }).into(self.tablename);
        }
      }));
    }).then(function () {
      return self.maybeCompact(inserts);
    }).asCallback(callback);
  });
};
SQLdown.prototype.compact = function () {
  var self = this;
  return this.knexDb(this.tablename).select('key', 'value').not.whereIn('id', function () {
    this.select('id').from(function () {
      this.select(self.knexDb.raw('max(id) as id')).from(self.tablename).groupBy('key').as('__tmp__table');
    });
  }).delete();
};

SQLdown.prototype.maybeCompact = function (inserts) {
  if (!this._compactable) {
    return Promise.resolve();
  }
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
    self.knexDb.destroy().asCallback(callback);
  });
};
SQLdown.prototype.pause = function (cb) {
  if (this.dbType !== 'mysql' || !this._paused) {
    cb();
  } else {
    this.knexDb.once('unpaused', cb);
  }
};
SQLdown.prototype.iterator = function (options) {
  var self = this;
  if (this.dbType === 'mysql') {
    debug('pausing iterator');
    this._paused++;
  }
  this._compactable = false;
  return new Iter(this, options, function () {
    self._compactable = true;
    self.maybeCompact();
  });
};
