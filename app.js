// jshint node: true
'use strict';

var gmeConfig = require('./config'),
    webgme = require('webgme'),
    myServer;

webgme.addToRequireJsPaths(gmeConfig);

myServer = new webgme.standaloneServer(gmeConfig);
myServer.start(function (err) {
    if (err) {
        process.exit(1);
    }

    console.log('DeepForge now listening on port', gmeConfig.server.port);
});
