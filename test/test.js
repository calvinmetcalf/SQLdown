var tape   = require('prova')
var leveljs = require('../')
var testCommon = require('./testCommon')

var testBuffer = new Buffer('foo')

/*** compatibility with basic LevelDOWN API ***/
function test(testCommon) {
  require('abstract-leveldown/abstract/leveldown-test').args(leveljs, tape, testCommon);
  require('abstract-leveldown/abstract/open-test').open(leveljs, tape, testCommon);
  require('abstract-leveldown/abstract/put-test').all(leveljs, tape, testCommon);
  require('abstract-leveldown/abstract/del-test').all(leveljs, tape, testCommon);
  require('abstract-leveldown/abstract/get-test').all(leveljs, tape, testCommon);
  require('abstract-leveldown/abstract/put-get-del-test').all(leveljs, tape, testCommon, testBuffer);
  require('abstract-leveldown/abstract/batch-test').all(leveljs, tape, testCommon)
  require('abstract-leveldown/abstract/chained-batch-test').all(leveljs, tape, testCommon)
  require('abstract-leveldown/abstract/close-test').close(leveljs, tape, testCommon);
  require('abstract-leveldown/abstract/iterator-test').all(leveljs, tape, testCommon)
  require('abstract-leveldown/abstract/ranges-test').all(leveljs, tape, testCommon)

  function custome(leveldown, test, testCommon) {

    var db;
    test('setUp common', testCommon.setUp)
    test('open close open', function (t) {
      db = leveldown(testCommon.location())

      // default createIfMissing=true, errorIfExists=false
      db.open(function (err) {
          t.notOk(err, 'no error')
          db.close(function (err) {
            t.notOk(err, 'no error')
            db.open(function (err) {
              t.notOk(err, 'no error')
              t.end();
            })  
          })
        })
    });
    test('close up', function (t) {
      db.close(function (err) {
        if (err) {
          process.exit(1);
        }
        t.end();
      });
    });
  }
  custome(leveljs, tape, testCommon)
}
if (process.env.DB === 'postgres') {
  test(testCommon('postgres://localhost/sqldown?table=_leveldown_test_db_'));
}  else if (process.env.DB === 'mysql') {
    test(testCommon('mysql://travis:@localhost/sqldown?table=_leveldown_test_db_'));
} else {
    test(testCommon('_leveldown_test_db_'));
}