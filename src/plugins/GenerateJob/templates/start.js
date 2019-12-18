/* eslint-disable no-console*/
// A wrapper for the worker script which:
//   - merges stdout, stderr
//   - receives some commands and uploads intermediate data
const spawn = require('child_process').spawn;
const fs = require('fs');
const {promisify} = require('util');
const mkdir = promisify(fs.mkdir);
const rm_rf = require('rimraf');
const path = require('path');
const Config = require('./config.json');
process.env.DEEPFORGE_HOST = Config.HOST;

// Create the stderr only logger
const logger = {};
const log = console.error;
['error', 'warn', 'info', 'log', 'debug'].forEach(method => logger[method] = log);
logger.fork = () => logger;

let remainingImageCount = 0;
let exitCode;

const requirejs = require('requirejs');
requirejs([
    './utils.build',
], function(
    Utils,
) {

    const {BlobClient, Storage, Constants} = Utils;
    const COMMAND_PREFIX = Constants.START_CMD;
    const IMAGE = Constants.IMAGE.PREFIX;

    process.env.MPLBACKEND = 'module://backend_deepforge';

    const url = process.env.DEEPFORGE_HOST || 'http://127.0.0.1:8888';
    const [protocol, , port] = url.split(':');
    const address = url.replace(protocol + '://', '')
        .replace(':' + port, '');

    let workerCacheDir = process.env.DEEPFORGE_WORKER_CACHE;

    // Create workerCacheDir if it doesn't exist
    var prepareCache = async function() {
        if (!workerCacheDir) {
            workerCacheDir = './worker-cache';
            const blobDir = process.env.DEEPFORGE_BLOB_DIR;
            const isSharingBlob = process.env.DEEPFORGE_WORKER_USE_BLOB === 'true';
            if (isSharingBlob && blobDir) {
                await makeIfNeeded(workerCacheDir);

                const blobContentDir = path.join(blobDir, 'wg-content');
                const gmeStorageCache = path.join(workerCacheDir, 'gme');
                rm_rf.sync(path.join(workerCacheDir, 'gme'));
                await symlink(blobContentDir, gmeStorageCache);
            }
        } else {
            await makeIfNeeded(workerCacheDir);
        }

    };

    var prepareInputsOutputs = function() {
        var dirs = ['artifacts', 'outputs'];
        return Promise.all(dirs.map(dir => makeIfNeeded(dir)));
    };


    var makeIfNeeded = async function(dir) {
        log(`makeIfNeeded: ${JSON.stringify(dir)}`);
        if (path.dirname(dir) !== dir) {
            await makeIfNeeded(path.dirname(dir));
        }

        try {
            await mkdir(dir);
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    };

    var blobClient = new BlobClient({
        server: address,
        httpsecure: protocol === 'https',
        serverPort: port,
        logger: logger
    });

    var checkFinished = () => {
        if (exitCode !== undefined && remainingImageCount === 0) {
            log('finished!');
            cleanup();
        }
    };

    var uploadImage = function(line) {
        var args = line.split(/\s+/),
            name = args.slice(3).join(' ').replace(/\s+$/, ''),
            filename = 'metadata/' + name + '.png';

        // Upload the image from metadata/
        remainingImageCount++;
        fs.readFile(filename, (err, content) => {
            if (err) {
                logger.error(`Could not read ${filename}: ${err}`);
                return;
            }

            // Add hash to the image command
            log('about to putFile', filename);
            blobClient.putFile(filename, content)
                .then(hash => {
                    args.splice(2, 0, hash);
                    console.log(args.join(' '));
                    log('printing cmd:', args.join(' '));
                    --remainingImageCount;
                    log('finished uploading ' + filename + ' ' + remainingImageCount + ' remain');
                    checkFinished();
                })
                .catch(err => logger.error(`${filename} upload failed: ${err}`));
        });
    };

    var onStderr = function(data) {
        var text = data.toString();
        // Filter out directory label from stack traces
        process.stdout.write(text.replace(/\.\.\.\/.*\/(main|deepforge|init).py/g, '$1'));
    };

    var onStdout = function(data) {
        var lines = data.toString().split('\n'),
            result = [],
            cmdStart;

        // Check for commands...
        for (var i = 0; i < lines.length; i++) {
            cmdStart = lines[i].indexOf(COMMAND_PREFIX);
            if (cmdStart !== -1 && lines[i].indexOf(IMAGE) !== -1) {
                uploadImage(lines[i]);
            } else {
                result.push(lines[i]);
            }
        }

        process.stdout.write(result.join('\n'));
    };

    var createCacheDir = function(cachePath) {
        return makeIfNeeded(path.dirname(cachePath));
    };

    var dataCachePath = async function(dataInfo) {
        const relPath = await Storage.getCachePath(dataInfo, logger);
        return `${workerCacheDir}/${relPath}`;
    };

    var getData = async function(ipath, dataInfo) {
        // Download the data and put it in the given path
        const deferred = defer();
        const inputName = ipath.split('/')[1];
        const cachePath = await dataCachePath(dataInfo);

        
        logger.debug(`retrieving ${ipath}`);
        fs.lstat(cachePath, async (err, cacheStats) => {
            // Check if the data exists in the cache
            if (!err && cacheStats.isFile()) {
                logger.info(`${inputName} already cached. Skipping retrieval from blob`);
                return symlink(cachePath, ipath).then(deferred.resolve);
            }

            await createCacheDir(cachePath);
            const buffer = await Storage.getFile(dataInfo, logger, Config.storageConfigs);
            fs.writeFile(cachePath, buffer, err => {
                if (err) {
                    logger.error('Retrieving ' + ipath + ' failed!');
                    return deferred.reject(`Could not write to ${ipath}: ${err}`);
                }
                // Create the symlink
                logger.info('Retrieved ' + ipath);
                return symlink(cachePath, ipath).then(deferred.resolve);
            });
        });

        return deferred.promise;
    };

    // Download the large files
    var inputData = JSON.parse(fs.readFileSync('./input-data.json')),
        inputPaths = Object.keys(inputData),
        pid,
        job,
        cleanup;

    // Make sure to kill the spawned process group on exit
    cleanup = function() {
        if (job) {
            pid = job.pid;
            job = null;
            log(`killing process group: ${pid}`);
            try {
                process.kill(-pid, 'SIGTERM');
            } catch (err) {
                if (!err.message.includes('ESRCH')) {
                    log('Error while killing process group: ' + err.message);
                }
            }
        }
        if (exitCode !== undefined) {
            if (exitCode !== null) {
                log(`exiting w/ code ${exitCode}`);
            } else {  // exited involuntarily
                log('script exited involuntarily (exit code is null)');
                return process.exit(1);
            }
            process.exit(exitCode);
        }
    };

    process.on('exit', () => {
        log('received "exit" event');
        cleanup();
    });
    process.on('SIGINT', function() {
        log('received "SIGINT" event');
        cleanup();
        process.exit(130);
    });
    process.on('uncaughtException', err => {
        log('received "uncaughtException" event');
        log(err);
        cleanup();
    });

    prepareCache()
        .then(prepareInputsOutputs)
        .then(() => Promise.all(inputPaths.map(ipath => getData(ipath, inputData[ipath]))))
        .then(() => {
            // Run 'python main.py' and merge the stdout, stderr
            job = spawn('python', ['main.py'], {detached: true});
            job.stdout.on('data', onStdout);
            job.stderr.on('data', onStderr);
            job.on('close', async code => {
                log('script finished w/ exit code:', code);
                try {
                    exitCode = code;
                    await uploadOutputData(code);
                } catch (err) {
                    exitCode = 1;
                    onStderr(err.message);
                }
                checkFinished();
            });
        })
        .catch(err => {
            console.log(`Data retrieval failed: ${err}`);
            process.exit(1);
        });

    async function uploadOutputData(exitCode) {
        if (exitCode === 0) {
            const results = require('./result-types.json');
            const storageId = Config.storage.id;
            const config = Config.storageConfigs[storageId];
            const client = await Storage.getBackend(storageId).getClient(logger, config);
            const outputNames = Object.keys(results);
            const storageDir = Config.storage.dir;

            for (let i = outputNames.length; i--;) {
                const filename = outputNames[i];
                const storagePath = `${storageDir}/${filename}`;
                const contents = fs.readFileSync(`outputs/${filename}`);
                const dataInfo = await client.putFile(storagePath, contents);
                const type = results[filename];
                results[filename] = {type, dataInfo};
            }

            fs.writeFileSync('results.json', JSON.stringify(results));
        }
    }

    function symlink(target, src) {
        var deferred = defer(),
            job;

        src = path.resolve(src);
        target = path.resolve(target);
        fs.stat(src, err => {
            if (err && err.code === 'ENOENT') {
                logger.debug(`creating symlink "ln -s ${target} ${src}"`);
                job = spawn('ln', ['-s', target, src || '.']);
                job.on('exit', code => {
                    if (code) {
                        deferred.reject(`Could not create symlink ${target} -> ${src||'.'}`);
                        return;
                    }
                    deferred.resolve();
                });
            }
            deferred.resolve();
        });
        return deferred.promise;
    }

    function defer() {
        const deferred = {};
        deferred.promise = new Promise((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        return deferred;
    }
});
