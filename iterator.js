'use strict';
var inherits = require('inherits');
var AbstractIterator = require('abstract-leveldown/abstract-iterator');
var IterStream = require('./iter-stream');
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
    if (!Buffer.isBuffer(thing)) {
      opts[name] = new Buffer(thing);
    }
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

  this._sql = this.buildSQL();
  if (this._limit > 0) {
    this._sql.limit(this._limit);
  }
  if (this._limit === 0) {
    this._next = function (cb) {
      process.nextTick(cb);
    };
  } else {
    this._sql = new IterStream(this._sql.stream());
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
Iterator.prototype._end = function (callback) {
  if (typeof this.___cb === 'function') {
    this.___cb();
    this.___cb = null;
  }
  callback();
};
Iterator.prototype._next = function (callback) {
  var self = this;
  if (self._ended) {
    return callback();
  }
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
        callback(value[0], value[1], value[2]);
      });
    }
  }
  this._sql.next(function (err, resp) {
    if (err || !resp) {
      return callback();
    }
    var key = resp.key;
    var value = resp.value || new Buffer('');

    if (!self._keyAsBuffer) {
      key = key.toString();
    }
    if (!self._valueAsBuffer) {
      value = value.toString();
    }
    callback(null, key, value);
  });
};

Iterator.prototype.buildSQL = function () {
  var self = this;
  var outersql = this._db.select('key', 'value').from(this.db.tablename);
  var innerSQL = this._db.max('id').from(self.db.tablename).groupBy('key');
  if (this._order)  {
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
    innerSQL.where('key','<', this._options.lt);
  }
  if ('lte' in this._options) {
    innerSQL.where('key','<=', this._options.lte);
  }
  if ('gt' in this._options) {
    innerSQL.where('key','>', this._options.gt);
  }
  if ('gte' in this._options) {
    innerSQL.where('key','>=', this._options.gte);
  }
  return outersql.whereIn('id', innerSQL);
};
