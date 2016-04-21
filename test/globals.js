// This is used by the test/plugins tests
/*globals requireJS*/
/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var testFixture = require('webgme/test/_globals'),
    WEBGME_CONFIG_PATH = '../config';

// This flag will make sure the config.test.js is being used
// process.env.NODE_ENV = 'test'; // This is set by the require above, overwrite it here.

var WebGME = testFixture.WebGME,
    gmeConfig = require(WEBGME_CONFIG_PATH),
    getGmeConfig = function getGmeConfig() {
    'use strict';
    // makes sure that for each request it returns with a unique object and tests will not interfere
    if (!gmeConfig) {
        // if some tests are deleting or unloading the config
        gmeConfig = require(WEBGME_CONFIG_PATH);
    }
    return JSON.parse(JSON.stringify(gmeConfig));
};

WebGME.addToRequireJsPaths(gmeConfig);

// Add the requirejs text plugin
testFixture.requirejs.config({
    paths: {
        text: 'client/lib/require/require-text/text'
    }
});
testFixture.getGmeConfig = getGmeConfig;

testFixture.SEED_DIR = testFixture.path.join(__dirname, '..', 'src', 'seeds', 'devMinimal');
module.exports = testFixture;
