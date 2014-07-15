var SQLdown = require('../');

var test = require('tape');

test('it should work', function (t) {
  var db = new SQLdown('location2');
  db.open(function (err) {
    t.error(err);
    t.end();
  });
});