/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 */

'use strict';

var config = require('./config.default'),
    path = require('path');

config.server.port = 9001;
config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_tests';
config.blob.fsDir = path.join(__dirname, '..', 'test-tmp', 'blob');

module.exports = config;
