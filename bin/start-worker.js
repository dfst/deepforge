'use strict';

var path = require('path'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    projectConfig = require(__dirname + '/../config'),
    executorSrc = path.join(__dirname, '..', 'node_modules', 'webgme', 'src',
        'server', 'middleware', 'executor', 'worker'),
    workerPath = path.join(__dirname, '..', 'src', 'worker'),
    workerConfigPath =  path.join(workerPath, 'config.json'),
    workerTmp = path.join(workerPath, 'tmp'),
    address,
    config = {};

var startExecutor = function() {
    // Start the executor
    var execJob = spawn('node', [
        'node_worker.js',
        workerConfigPath,
        workerTmp
        ]);
    execJob.stdout.pipe(process.stdout);
    execJob.stderr.pipe(process.stderr);
};

var createConfigJson = function() {
    // Create the config.json
    address = 'http://localhost:'+projectConfig.server.port;

    if (process.argv.length > 2) {
        address = process.argv[2];
    }

    config[address] = {};
    // TODO: Check if the config already exists
    fs.writeFile(workerConfigPath, JSON.stringify(config), startExecutor);
};

process.chdir(executorSrc);

fs.mkdir(workerTmp, function() {
    // npm install in this directory
    var npmInstall = spawn('npm', ['install']);
    npmInstall.stdout.pipe(process.stdout);
    npmInstall.stderr.pipe(process.stderr);
    npmInstall.on('close', function() {
        createConfigJson();
    });
});
