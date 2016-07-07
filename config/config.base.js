/*globals require, module, process*/
'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

require('dotenv').load({silent: true});

// Add/overwrite any additional settings here
config.server.port = +process.env.PORT || config.server.port;
config.mongo.uri = process.env.MONGO_URI || config.mongo.uri;
config.requirejsPaths.deepforge = './src/common';
config.seedProjects.defaultProject = 'project';

config.plugin.allowBrowserExecution = true;
config.plugin.allowServerExecution = true;

config.executor.enable = true;
config.executor.clearOldDataAtStartUp = true;

config.visualization.extraCss.push('deepforge/styles/global.css');

validateConfig(config);
module.exports = config;
