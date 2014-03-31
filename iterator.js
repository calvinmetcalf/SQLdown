'use strict';
var inherits = require('util').inherits;
var AbstractIterator = require('abstract-leveldown/abstract-iterator');
var GET = 'SELECT key, value FROM sqldown';
var limitStuff = 'LIMIT 1';
function format(inStr) {
  if (typeof inStr === 'number') {
    return inStr;
  } else {
    return '\'' + inStr + '\'';
  }
}
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
  options = options || {};
  this._order = !options.reverse;
  this._options = options;
  names.forEach(function (i) {
    goodOptions(options, i);
  });
  this._count = 0;
  this._limit = options.limit || -1;
  this._sql = this.buildSQL();
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
}
Iterator.prototype._next = function (callback) {
  var self = this;
  if (this._limit > -1 && this._count >= this._limit) {
    return process.nextTick(function () {
      callback();
    });
  }
  var offset = this._count++;
  var sql = this._sql;
  if (offset) {
    sql += ' OFFSET ';
    sql += offset;
  }
  sql += ';';
  
  this.db.db.get(sql, function (err, resp) {
    if (err) {
      console.log(err);
      console.log(sql);
      return callback(err);
    }
    if (!resp || this._ended) {
      return callback();
    }
    var key = resp.key;
    var value;
    try {
      value = JSON.parse(resp.value);
    } catch (e) {
      return callback(e);
    }
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
  var sql = GET;
  var order;
  if (this._order)  {
    order = ' ORDER BY key ';
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
    order = ' ORDER BY key DESC ';
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
  var queries = [];
  if ('lt' in this._options) {
    queries.push('key < ' + format(this._options.lt));
  }
  if ('lte' in this._options) {
    queries.push('key <= ' + format(this._options.lte));
  }
  if ('gt' in this._options) {
    queries.push('key > ' + format(this._options.gt));
  }
  if ('gte' in this._options) {
    queries.push('key >= ' + format(this._options.gte));
  }
  if (queries.length) {
    sql += ' WHERE ' + queries.join(' AND ');
  }
  sql += order;
  sql += limitStuff;
  return sql;
};