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
function Iterator(db, options) {
  AbstractIterator.call(this, db);
  this._db = db.db;
  options = options || {};
  this._order = !options.reverse;
  this._options = options;
  names.forEach(function (i) {
    goodOptions(options, i);
  });
  this._count = 0;
  this._limit = options.limit || -1;
  this._sql = this.buildSQL();
  if (this._limit > 0) {
    this._sql.limit(this._limit);
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
  this._sql = new IterStream(this._sql.stream());
}
Iterator.prototype._next = function (callback) {
  var self = this;
  if (self._ended) {
    callback();
  }
  this._sql.next(function (err, resp) {
    if (err) {
      return callback();
    }
    var key = resp.key;
    var value = JSON.parse(resp.value);

    if (self._keyAsBuffer) {
      key = new Buffer(key);
    }
    if (self._valueAsBuffer) {
      value = new Buffer(value);
    } else if (typeof value !== 'string') {
      value = String(value);
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