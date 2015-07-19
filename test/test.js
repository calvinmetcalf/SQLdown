'use strict';
var tape   = require('tape')
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

  function custom(leveldown, test, testCommon) {

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
        testCommon.cleanup(function (){
          t.end();
        });
      });
    });

    test('setUp common', testCommon.setUp)
    test('test keySize', function (t) {
      db = leveldown(testCommon.location())

      // default createIfMissing=true, errorIfExists=false
      db.open({
        keySize: 150,
        valueSize: 150
      }, function (err) {
          t.notOk(err, 'no error in open')
          db.put('foo', 'bar', function (err) {
            t.notOk(err, 'no error in put')
            db.get('foo', {
              asBuffer: false
            }, function (err, value) {
              t.notOk(err, 'no error in get')
              t.equals('bar', value);
              t.end();
            });
          });
        })
    });
    test('close up', function (t) {
      db.close(function (err) {
        if (err) {
          process.exit(1);
        }
        testCommon.cleanup(function (){
          t.end();
        });
      });
    });
    if (process.env.DB === 'mysql') {
      test('setUp common', testCommon.setUp)
      test('test keySize2', function (t) {
        db = leveldown(testCommon.location())

        // default createIfMissing=true, errorIfExists=false
        db.open({keySize: 3}, function (err) {
            t.notOk(err, 'no error in open')
            db.put('foobar', 'bar', function (err) {
              t.not(err, 'error in put')
              db.get('foo', {
                asBuffer: false
              }, function (err) {
                t.not(err, 'error in get')
                t.end();
              });
            });
          })
      });
      test('close up', function (t) {
        db.close(function (err) {
          if (err) {
            process.exit(1);
          }
          testCommon.cleanup(function (){
            t.end();
          });
        });
      });
      test('setUp common', testCommon.setUp)
      test('test valuesize', function (t) {
        db = leveldown(testCommon.location())

        // default createIfMissing=true, errorIfExists=false
        db.open({valueSize: 3}, function (err) {
            t.notOk(err, 'no error in open')
            db.put('foo', 'barvar', function (err) {
              t.not(err, 'error in put')
              db.get('foo', {
                asBuffer: false
              }, function (err) {
                t.not(err, 'error in get')
                t.end();
              });
            });
          })
      });
      test('close up', function (t) {
        db.close(function (err) {
          if (err) {
            process.exit(1);
          }
          testCommon.cleanup(function (){
            t.end();
          });
        });
      });
    }
  }
  custom(leveljs, tape, testCommon)
}
if (process.env.DB === 'postgres') {
  test(testCommon('postgres://localhost/sqldown?table=_leveldown_test_db_'));
}  else if (process.env.DB === 'mysql') {
    test(testCommon('mysql://travis:@localhost/sqldown?table=_leveldown_test_db_'));
} else {
    test(testCommon('_leveldown_test_db_'));
}
