var tape   = require('tape')
var leveljs = require('../')
var testCommon = require('./testCommon')

var testBuffer = new Buffer('foo')

/*** compatibility with basic LevelDOWN API ***/
require('abstract-leveldown/abstract/leveldown-test').args(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/open-test').open(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/put-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/del-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/get-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/put-get-del-test').all(leveljs, tape, testCommon, testBuffer)