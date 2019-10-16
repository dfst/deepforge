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
    if (path.dirname(dir) !== dir) {
        createDir(path.dirname(dir));
    }
    try {
        fs.statSync(dir);
    } catch (e) {
        // Create dir
        fs.mkdirSync(dir);
        return true;
    }
    return false;
};

const symlink = function(origin, link) {
    try {
        fs.statSync(link);
    } catch (e) {
        childProcess.spawnSync('ln', ['-s', origin, link]);
    }
};

createDir(workerTmp);

// Create sym link to the node_modules and to deepforge
const modules = path.join(workerRootPath, 'node_modules');
symlink(`${__dirname}/../node_modules`, modules);

var cleanUp = function() {
    console.log('removing worker directory ', workerPath);
    rm_rf.sync(workerPath);
};

var startExecutor = function() {
    process.on('SIGINT', cleanUp);
    process.on('uncaughtException', cleanUp);

    // Configure the cache
    const blobDir = process.env.DEEPFORGE_BLOB_DIR;
    const isSharingBlob = process.env.DEEPFORGE_WORKER_USE_BLOB === 'true' &&
        !!blobDir;

    if (process.env.DEEPFORGE_WORKER_CACHE && isSharingBlob) {
        // Create the cache directory and symlink the blob in cache/gme
        createDir(process.env.DEEPFORGE_WORKER_CACHE);

        const blobContentDir = path.join(blobDir, 'wg-content');
        const gmeStorageCache = path.join(process.env.DEEPFORGE_WORKER_CACHE, 'gme');
        rm_rf.sync(gmeStorageCache);
        symlink(blobContentDir, gmeStorageCache);
    }

    // Start the executor
    const env = Object.assign({}, process.env);
    env.DEEPFORGE_ROOT = path.join(__dirname, '..');

    const options = {env: env};
    var execJob = spawn('node', [
        executorSrc,
        workerConfigPath,
        workerTmp
    ], options);
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
