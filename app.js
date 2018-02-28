// jshint node: true
'use strict';

var gmeConfig = require('./config'),
    webgme = require('webgme'),
    path = require('path'),
    fs = require('fs'),
    rm_rf = require('rimraf'),
    gracefulFs = require('graceful-fs'),
    myServer;

process.chdir(__dirname);
webgme.addToRequireJsPaths(gmeConfig);

// Patch the 'fs' module to fix 'too many files open' error
gracefulFs.gracefulify(fs);

// Clear seed hash info
['pipeline'].map(lib => path.join(__dirname, 'src', 'seeds', lib, 'hash.txt'))
    .forEach(file => rm_rf.sync(file));

myServer = new webgme.standaloneServer(gmeConfig);
myServer.start(function (err) {
    if (err) {
        process.exit(1);
    }

    console.log('DeepForge now listening on port', gmeConfig.server.port);
});
