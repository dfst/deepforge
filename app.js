// jshint node: true
'use strict';

var gmeConfig = require('./config'),
    webgme = require('webgme'),
    path = require('path'),
    rm_rf = require('rimraf'),
    myServer;

webgme.addToRequireJsPaths(gmeConfig);

// Clear seed hash info
['nn', 'pipeline'].map(lib => path.join(__dirname, 'src', 'seeds', lib, 'hash.txt'))
    .forEach(file => rm_rf.sync(file));

myServer = new webgme.standaloneServer(gmeConfig);
myServer.start(function (err) {
    if (err) {
        process.exit(1);
    }

    console.log('DeepForge now listening on port', gmeConfig.server.port);
});
