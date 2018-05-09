// jshint node: true
'use strict';

var config = require('./config.base'),
    validateConfig = require('webgme/config/validator');

// Add/overwrite any additional settings here
// config.server.port = 8080;
// config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_my_app';

// Seeds for development are prefixed with 'dev'
config.seedProjects.basePaths = ['src/seeds/project'];

// user accounts. uncomment the following for enabling user accounts
// config.authentication.enable = true;
// config.authentication.allowGuests = true;
// config.authentication.allowUserRegistration = true;

validateConfig(config);
module.exports = config;
