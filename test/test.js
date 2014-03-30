var tape   = require('tape')
var leveljs = require('../')
var testCommon = require('./testCommon')

// load IndexedDBShim in the tests
require('./idb-shim.js')()

var testBuffer = new Buffer('foo')

/*** compatibility with basic LevelDOWN API ***/
require('abstract-leveldown/abstract/leveldown-test').args(leveljs, tape, testCommon);