/*globals process, __dirname, require*/

var path = require('path'),
    fs = require('fs'),
    childProcess = require('child_process'),
    spawn = childProcess.spawn,
    rm_rf = require('rimraf'),
    projectConfig = require(__dirname + '/../config'),
    executorSrc = path.join(__dirname, '..', 'node_modules', '.bin', 'webgme-executor-worker'),
    id = Date.now(),
    workerRootPath = process.env.DEEPFORGE_WORKER_DIR || path.join(__dirname, '..', 'src', 'worker'),
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

// Create sym link to the node_modules
var modules = path.join(workerRootPath, 'node_modules');
try {
    fs.statSync(modules);
} catch (e) {
    // Create dir
    childProcess.spawnSync('ln', ['-s', `${__dirname}/../node_modules`, modules]);
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
        executorSrc,
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
        if (!/^https?:\/\//.test(address)) {
            address = 'http://' + address;
        }
    }

    config[address] = {};
    fs.writeFile(workerConfigPath, JSON.stringify(config), startExecutor);
};

fs.mkdir(workerTmp, createConfigJson);
