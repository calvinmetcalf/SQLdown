'use strict';
var Queue = require('double-ended-queue');
var through = require('through2').obj;
var EE = require('events').EventEmitter;
var inherits = require('inherits');
module.exports = IterStream;
inherits(IterStream, EE);
function IterStream(stream) {
  if (!(this instanceof IterStream)) {
    return new IterStream(stream);
  }
  var self = this;
  EE.call(self);
  this.stream = stream;
  this.queue = new Queue();
  this.stream.pipe(through(function (chunk, _, next) {
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
    while(!self.queue.isEmpty()) {
      self.queue.shift()(new Error('ended'));
    }
    self.on('callback', function () {
      while(!self.queue.isEmpty()) {
        self.queue.shift()(new Error('ended'));
      }
    });
    next();
  }));
}
IterStream.prototype.next = function (callback) {
  this.queue.push(callback);
  this.emit('callback');
};