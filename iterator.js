'use strict';
var inherits = require('inherits');
var AbstractIterator = require('abstract-leveldown/abstract-iterator');
var IterStream = require('./iter-stream');
var util = require('./encoding');
var debug = require('debug')('sqldown:iterator');

function goodOptions(opts, name) {
  if (!(name in opts)) {
    return;
  }
  var thing = opts[name];
  if (thing === null) {
    delete opts[name];
    return;
  }
  if (Buffer.isBuffer(thing) || typeof thing === 'string') {
    if (!thing.length) {
      delete opts[name];
      return;
    }

    opts[name] = util.encode(thing);
  }

}
inherits(Iterator, AbstractIterator);
module.exports = Iterator;
var names = [
  'start',
  'end',
  'gt',
  'gte',
  'lt',
  'lte'
];
function Iterator(db, options, cb) {
  AbstractIterator.call(this, db);
  this._db = db.knexDb;
  options = options || {};
  this._order = !options.reverse;
  this._options = options;
  names.forEach(function (i) {
    goodOptions(options, i);
  });
  this._count = 0;
  var self = this;
  if ('limit' in options) {
    this._limit = options.limit;
  } else {
    this._limit = -1;
  }

  if ('keyAsBuffer' in options) {
    this._keyAsBuffer = options.keyAsBuffer;
  } else {
    this._keyAsBuffer = true;
  }
  if ('valueAsBuffer' in options) {
    this._valueAsBuffer = options.valueAsBuffer;
  } else {
    this._valueAsBuffer = true;
  }

  var makeSql;
  if (db.dbType === 'mysql') {
    makeSql = this.getCurrentId().then(function (key) {
      return [self.buildSQL(key)];
    });
  } else {
    makeSql = this.buildSQL();
  }
  if (this._limit === 0) {
    this._next = function (cb) {
      process.nextTick(cb);
    };
  } else {
    if (db.dbType === 'mysql') {
      this._sql = new IterStream(makeSql, this.db);
    } else {
      this._sql = new IterStream(makeSql);
    }
    this.__value = null;
    this.__cb = null;
    this.___cb = cb;
    this._next(function (err, key, value) {
      if (typeof self.__cb === 'function') {
        self.__value = null;
        if (self._ended || (err === void 0 && key === void 0 && value === void 0)) {
          return self.__cb();
        }
        self.__cb(err, key, value);
        self.__cb = null;
      } else {
        self.__value = [err, key, value];
      }
      if (typeof self.___cb === 'function') {
        self.___cb();
        self.___cb = null;
      }
    });
    this.__value = 'in progress';
  }
}

Iterator.prototype._next = function (callback) {
  debug('_nexting');
  var self = this;
  if (self._ended) {
    if (typeof this.___cb === 'function') {
      this.___cb();
      this.___cb = null;
    }
    return callback();
  }
  debug(this.__value);
  if (this.__value !== null) {
    if (this.__value === 'in progress') {
      this.__cb = callback;
      return;
    } else {
      return process.nextTick(function () {
        var value = self.__value;
        self.__value = null;
        if (value.every(function (val) {
          return val === void 0;
        })) {
          return callback();
        }
        debug(value);
        callback(value[0], value[1], value[2]);
      });
    }
  }
  this._sql.next(function (err, resp) {
    debug(err, resp);
    if (err || !resp || !resp.value) {
      return callback();
    }
    var key = util.decode(resp.key, self._keyAsBuffer);
    var value = util.decode(resp.value, self._valueAsBuffer, true);

    if (!self._keyAsBuffer) {
      key = key.toString();
    }
    if (!self._valueAsBuffer) {
      value = value.toString();
    }
    callback(null, key, value);
  });
};

Iterator.prototype.buildSQL = function (maxKey) {
  debug(maxKey);
  var self = this;
  var outersql = this._db.select('key', 'value').from(this.db.tablename).whereNotNull('value');
  var innerSQL = this._db.max('id').from(self.db.tablename).groupBy('key');
  if (typeof maxKey !== 'undefined') {
    innerSQL.where('id', '<=', maxKey);
  }
  if (this._order) {
    outersql.orderBy('key');
    if ('start' in this._options) {
      if (this._options.exclusiveStart) {
        if ('start' in this._options) {
          this._options.gt = this._options.start;
        }
      } else {
        if ('start' in this._options) {
          this._options.gte = this._options.start;
        }
      }
    }
    if ('end' in this._options) {
      this._options.lte = this._options.end;
    }
  } else {
    outersql.orderBy('key', 'DESC');
    if ('start' in this._options) {
      if (this._options.exclusiveStart) {
        if ('start' in this._options) {
          this._options.lt = this._options.start;
        }
      } else {
        if ('start' in this._options) {
          this._options.lte = this._options.start;
        }
      }
    }
    if ('end' in this._options) {
      this._options.gte = this._options.end;
    }
  }

  if ('lt' in this._options) {
    innerSQL.where('key', '<', this._options.lt);
  }
  if ('lte' in this._options) {
    innerSQL.where('key', '<=', this._options.lte);
  }
  if ('gt' in this._options) {
    innerSQL.where('key', '>', this._options.gt);
  }
  if ('gte' in this._options) {
    innerSQL.where('key', '>=', this._options.gte);
  }
  outersql.whereIn('id', innerSQL);
  if (this._limit > 0) {
    outersql.limit(this._limit);
  }
  return outersql;
};
Iterator.prototype.getCurrentId = function () {
  return this._db.select(this._db.raw('max(id) as id')).from(this.db.tablename).then(function (resp) {
    debug('get id');
    debug(resp);
    return resp[0].id;
  });
};
