/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 */

'use strict';

var config = require('./config.default'),
    path = require('path');

config.server.port = 8080;
config.mongo.uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
config.mongo.uri = config.mongo.uri.replace(/\/[a-zA-Z_\-]*$/,  '') + '/deepforge_tests';
config.blob.fsDir = path.join(__dirname, '..', 'test-tmp', 'blob');

module.exports = config;
