// This is used by the test/plugins tests
/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var testFixture = require('webgme/test/_globals'),
    path = require('path'),
    fs = require('fs'),
    exists = require('exists-file'),
    WEBGME_CONFIG_PATH = `${__dirname}/../config`;

// This flag will make sure the config.test.js is being used
// process.env.NODE_ENV = 'test'; // This is set by the require above, overwrite it here.

var WebGME = testFixture.WebGME,
    gmeConfig = require(WEBGME_CONFIG_PATH),
    getGmeConfig = function getGmeConfig() {
        // makes sure that for each request it returns with a unique object and tests will not interfere
        if (!gmeConfig) {
            // if some tests are deleting or unloading the config
            console.log('requiring:', WEBGME_CONFIG_PATH);
            gmeConfig = require(WEBGME_CONFIG_PATH);
        }
        return JSON.parse(JSON.stringify(gmeConfig));
    };

WebGME.addToRequireJsPaths(gmeConfig);

testFixture.getGmeConfig = getGmeConfig;

testFixture.DF_SEED_DIR = testFixture.path.join(__dirname, '..', 'src', 'seeds');

testFixture.mkdir = function(dir) {
    var dirs = path.resolve(dir).split(path.sep),
        shortDir,
        i = 1;

    while (i++ < dirs.length) {
        shortDir = dirs.slice(0,i).join(path.sep);
        if (!exists.sync(shortDir)) {
            fs.mkdirSync(shortDir);
        }
    }
};

module.exports = testFixture;
