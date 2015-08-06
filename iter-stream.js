'use strict';
var Queue = require('double-ended-queue');
var through = require('through2').obj;
var EE = require('events').EventEmitter;
var inherits = require('inherits');
var debug = require('debug')('sqldown:iter-stream');

module.exports = IterStream;
inherits(IterStream, EE);
function IterStream(_stream, db) {
  if (!(this instanceof IterStream)) {
    return new IterStream(_stream, db);
  }
  var self = this;
  EE.call(self);
  this.stream = null;
  this.queue = new Queue();
  var outStream = through(function (chunk, _, next) {
    debug('transform');
    if (self.queue.isEmpty()) {
      self.once('callback', function () {
        self.queue.shift()(null, chunk);
        next();
      });
    } else {
      self.queue.shift()(null, chunk);
      next();
    }
  }, function (next) {
    debug('flush');
    while(!self.queue.isEmpty()) {
      self.queue.shift()(new Error('ended'));
    }
    self.on('callback', function () {
      while(!self.queue.isEmpty()) {
        self.queue.shift()(new Error('ended'));
      }
    });
    next();
  });
  if (db) {
    _stream.then(function (query) {
      var stream = query[0].stream();
      self.stream = stream;
      db._paused--;
      debug(db._paused);
      if (!db._paused) {
        debug('unpause');
        db.knexDb.emit('unpaused');
      }
      stream.pipe(outStream);
    }).catch(function (e) {
      db._paused--;
      debug(db._paused);
      if (!db._paused) {
        debug('unpause after error');
        db.knexDb.emit('unpaused');
      }
      if (self.queue.isEmpty()) {
        self.once('callback', function () {
          self.queue.shift()(e);
        });
      } else {
        self.queue.shift()(e);
      }
    });
  } else {
    this.stream = _stream.stream();
    this.stream.pipe(outStream);
  }
}
IterStream.prototype.next = function (callback) {
  this.queue.push(callback);
  this.emit('callback');
};
