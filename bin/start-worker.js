/*globals process, __dirname, require*/

var path = require('path'),
    fs = require('fs'),
    childProcess = require('child_process'),
    spawn = childProcess.spawn,
    rm_rf = require('rimraf'),
    projectConfig = require(__dirname + '/../config'),
    executorSrc = path.join(__dirname, '..', 'node_modules', 'webgme', 'src',
        'server', 'middleware', 'executor', 'worker'),
    id = Date.now(),
    workerRootPath = path.join(__dirname, '..', 'src', 'worker'),
    workerPath = path.join(workerRootPath, `worker_${id}`),
    workerConfigPath =  path.join(workerPath, 'config.json'),
    workerTmp = path.join(workerPath, 'tmp'),
    address,
    config = {};

var createDir = function(dir) {
    try {
        fs.statSync(dir);
    } catch (e) {
        // Create dir
        fs.mkdirSync(dir);
        return true;
    }
    return false;
};
createDir(workerRootPath);
createDir(workerPath);
createDir(workerTmp);

// Check torch support
var result = childProcess.spawnSync('th', ['--help']);
if (result.error) {
    console.error('Checking Torch7 dependency failed. Do you have Torch7 installed ' + 
        'and in your PATH?\n\nFor Torch7 installation instructions, check out ' +
        'http://torch.ch/docs/getting-started.html');
    process.exit(1);
}

var cleanUp = function() {
    console.log('removing worker directory ', workerPath);
    rm_rf.sync(workerPath);
};

var startExecutor = function() {
    process.on('SIGINT', cleanUp);
    process.on('uncaughtException', cleanUp);

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
