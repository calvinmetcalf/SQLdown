var KEY_ENCODING = 'base64';
var VALUE_ENCODING = 'binary';

module.exports = {
  encodeKey: encodeKey,
  encodeValue: encodeValue,
  decodeValue: decodeValue,
};

function encodeKey(input) {
  if (Buffer.isBuffer(input)) {
    return input.toString(KEY_ENCODING);
  } else {
    return input;
  }
}

function encodeValue(input) {
  if (Buffer.isBuffer(input)) {
    input = { type: 'Buffer', data: input.toString(VALUE_ENCODING) };
  } else {
    input = String(input)
  }
  input = JSON.stringify(input);
  return input;
}

function decodeValue(input, asBuffer) {
  var input = JSON.parse(input);
  if (input && input.type === 'Buffer' && input.data) {
    input = Buffer(input.data, VALUE_ENCODING);
  } else if (asBuffer) {
    input = Buffer(String(input));
  }
  return input
}

function decodeValueToBuffer(input) {
  return Buffer(input, VALUE_ENCODING);
}