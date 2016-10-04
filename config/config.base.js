/*globals require, module, process*/
'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

require('dotenv').load({silent: true});

// Add/overwrite any additional settings here
config.server.port = +process.env.PORT || config.server.port;
config.mongo.uri = process.env.MONGO_URI || config.mongo.uri;
config.blob.fsDir = process.env.DEEPFORGE_BLOB_DIR || config.blob.fsDir;

config.requirejsPaths.deepforge = './src/common';
config.requirejsPaths.ace = './src/visualizers/widgets/TextEditor/lib/ace';
config.seedProjects.defaultProject = 'project';

config.plugin.allowBrowserExecution = true;
config.plugin.allowServerExecution = true;

config.executor.enable = true;
config.executor.clearOldDataAtStartUp = true;

config.visualization.extraCss.push('deepforge/styles/global.css');

config.storage.autoMerge.enable = true;

validateConfig(config);
module.exports = config;
