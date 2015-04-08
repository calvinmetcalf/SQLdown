var keyEncoding = 'utf8';
var valueEncoding = 'binary';

module.exports = {
  encodeKey: encodeKey,
  encodeValue: encodeValue,
  decodeValue: decodeValue,
  keyEncoding: keyEncoding,
  valueEncoding: valueEncoding,
};

function encodeKey(input) {
  if (Buffer.isBuffer(input)) {
    return input.toString(keyEncoding);
  } else {
    return input;
  }
}

function encodeValue(input) {
  if (Buffer.isBuffer(input)) {
    input = { type: 'Buffer', data: input.toString(valueEncoding, valueEncoding) };
  } else {
    input = String(input)
  }
  input = JSON.stringify(input);
  return input;
}

function decodeValue(input, asBuffer) {
  var input = JSON.parse(input);
  if (input && input.type === 'Buffer' && input.data) {
    input = Buffer(input.data, valueEncoding);
  } else if (asBuffer) {
    input = Buffer(String(input));
  }
  return input
}

function decodeValueToBuffer(input) {
  return Buffer(input, valueEncoding);
}