'use strict';


function encode(value, isValue) {
  if (isValue && !value) {
    value = new Buffer('');
  }
  if (!Buffer.isBuffer(value) && typeof value !== 'string') {
    value = String(value);
  }
  if (!Buffer.isBuffer(value)) {
    value = new Buffer(value);
  }
  return value;
}

function decode(value, asBuffer) {
  if (asBuffer) {
    return value;
  } else {
    return value.toString();
  }
}
if (process.browser) {
  exports.encode = function (value, isValue) {
    var out = encode(value, isValue);
    return out.toString(isValue ? 'base64' : 'hex');
  };
  exports.decode = function (value, asBuffer, isValue) {
    return decode(new Buffer(value, isValue ? 'base64' : 'hex'), asBuffer);
  };
} else {
  exports.encode = encode;
  exports.decode = decode;
}
