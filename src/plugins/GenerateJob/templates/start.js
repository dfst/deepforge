/* eslint-disable no-console*/
// A wrapper for the worker script which:
//   - merges stdout, stderr
//   - receives some commands and uploads intermediate data
const childProcess = require('child_process');
const {spawn} = childProcess;
const fs = require('fs');
const {promisify} = require('util');
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const lstat = promisify(fs.lstat);
const exec = promisify(childProcess.exec);
const rm_rf = require('rimraf');
const path = require('path');
const Config = require('./config.json');
process.env.DEEPFORGE_HOST = Config.HOST;
const BASE_CONDA_ENV = 'deepforge';

// Create the stderr only logger
const logger = {};
const log = console.error;
['error', 'warn', 'info', 'log', 'debug'].forEach(method => logger[method] = log);
logger.fork = () => logger;

let remainingImageCount = 0;
let exitCode;
class DataRetrievalError extends Error {
    constructor(name, err) {
        const message = `Data retrieval failed for ${name}: ${err}`;
        super(message);
    }
}

const requirejs = require('requirejs');
requirejs([
    './utils.build',
], function(
    Utils,
) {

    const {BlobClient, Storage, Constants} = Utils;
    const COMMAND_PREFIX = Constants.START_CMD;
    const IMAGE = Constants.IMAGE.PREFIX;
    const url = process.env.DEEPFORGE_HOST || 'http://127.0.0.1:8888';
    const [protocol, , port] = url.split(':');
    const address = url.replace(protocol + '://', '')
        .replace(':' + port, '');
    const blobClient = new BlobClient({
        server: address,
        httpsecure: protocol === 'https',
        serverPort: port,
        logger: logger
    });

    main();

    async function main() {
        process.env.MPLBACKEND = 'module://backend_deepforge';

        // Download the large files
        const inputData = require('./input-data.json');
        let job;

        // Make sure to kill the spawned process group on exit

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

        const envName = await prepareCondaEnvironment(__dirname);
        const workerCacheDir = await prepareCache(process.env.DEEPFORGE_WORKER_CACHE);
        await prepareInputsOutputs();
        try {
            const fetchData = inputData
                .map(async tuple => {
                    const [path, dataInfo, config] = tuple;
                    try {
                        await getData(workerCacheDir, path, dataInfo, config);
                    } catch (err) {
                        const [, inputName] = path.split('/');
                        throw new DataRetrievalError(inputName, err);
                    }
                });
            await Promise.all(fetchData);
        } catch (err) {
            console.log(err.message);
            process.exit(1);
        }

        // Run 'python main.py' and merge the stdout, stderr
        const [cmd, args] = await getJobStartCommand(envName);
        job = spawn(cmd, args, {detached: true});
        job.stdout.on('data', onStdout.bind(null, job));
        job.stderr.on('data', onStderr);
        job.on('close', async code => {
            log('script finished w/ exit code:', code);
            await deleteCondaEnvironment(envName);
            try {
                exitCode = code;
                await uploadOutputData(code);
            } catch (err) {
                exitCode = 1;
                onStderr(err.message);
            }
            checkFinished(job);
        });
    }

    async function prepareCondaEnvironment(jobDir) {
        if (!await hasConda()) {
            return null;
        }
        const envs = await getCondaEnvironments();
        if (!envs.includes(BASE_CONDA_ENV)) {
            await createBaseEnvironment(jobDir);
        }
        const jobEnvFile = path.join(jobDir, 'environment.yml');
        const envName = await updateCondaEnvironment(jobEnvFile);
        return envName;
    }

    async function hasConda() {
        try {
            await conda('-V');
            return true;
        } catch (err) {
            return false;
        }
    }

    async function createBaseEnvironment(jobDir) {
        const envFile = path.join(jobDir, 'environment.worker.yml');
        await conda(`env create -n ${BASE_CONDA_ENV} -f ${envFile}`);
    }

    async function getJobStartCommand(envName) {
        if (envName) {
            return [
                'conda',
                ['run', '-n', envName, 'python', 'main.py']
            ];
        } else if (await hasConda()) {
            return [
                'conda',
                ['run', '-n', BASE_CONDA_ENV, 'python', 'main.py']
            ];
        }

        return ['python', ['main.py']];
    }

    async function uploadOutputData(exitCode) {
        if (exitCode === 0) {
            const results = require('./result-types.json');
            const storageId = Config.storage.id;
            const config = Config.storage.config;
            const client = await Storage.getClient(storageId, logger, config);
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

    async function existsFile(path) {
        try {
            const cacheStats = await lstat(path);
            return cacheStats.isFile();
        } catch (err) {
            return false;
        }
    }

    async function updateCondaEnvironment(filepath) {
        const exists = await existsFile(filepath);
        if (exists) {
            let name;
            try {
                name = await getCondaEnvironmentName(BASE_CONDA_ENV);
                await conda(`create -n ${name} --clone ${BASE_CONDA_ENV}`);
                await conda(`env update -n ${name} --file ${filepath}`);
                return name;
            } catch (err) {
                deleteCondaEnvironment(name).catch(nop);
                logger.warn(`Unable to update conda environment: ${err}`);
            }
        }
    }

    async function getCondaEnvironmentName(basename) {
        const envs = await getCondaEnvironments();
        let newEnvName = basename;
        let counter = Math.floor(1000*Math.random());
        while (envs.includes(newEnvName)) {
            newEnvName = `${basename}_${counter++}`;
        }
        return newEnvName;
    }

    async function getCondaEnvironments() {
        const {stdout} = await conda('env list');
        const names = stdout.split('\n')
            .filter(line => !line.startsWith('#'))
            .map(line => line.replace(/\s+.*$/, ''));

        return names;
    }

    async function deleteCondaEnvironment(envName) {
        if (envName) {
            await conda(`env remove -n ${envName}`);
        }
    }

    async function conda(command) {
        return await exec(`conda ${command}`);
    }

    async function getData(cacheDir, ipath, dataInfo, config) {
        // Download the data and put it in the given path
        const inputName = ipath.split('/')[1];
        const cachePath = await dataCachePath(cacheDir, dataInfo);

        logger.debug(`retrieving ${ipath}`);
        const exists = await existsFile(cachePath);
        if (!exists) {
            await createCacheDir(cachePath);
            const client = await Storage.getClient(dataInfo.backend, null, config);
            const buffer = await client.getFile(dataInfo);
            await writeFile(cachePath, buffer);
        } else {
            logger.info(`${inputName} already cached. Skipping retrieval from blob`);
        }

        logger.info('Retrieved ' + ipath);
        return symlink(cachePath, ipath);
    }

    async function prepareCache(workerCacheDir) {
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
        return workerCacheDir;
    }

    function prepareInputsOutputs () {
        var dirs = ['artifacts', 'outputs'];
        return Promise.all(dirs.map(dir => makeIfNeeded(dir)));
    }

    async function makeIfNeeded(dir) {
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
    }

    function cleanup(job) {
        if (job) {
            const pid = job.pid;
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
    }

    function checkFinished(job) {
        if (exitCode !== undefined && remainingImageCount === 0) {
            log('finished!');
            cleanup(job);
        }
    }

    function uploadImage(job, line) {
        const args = line.split(/\s+/);
        const name = args.slice(3).join(' ').replace(/\s+$/, '');
        const filename = 'metadata/' + name + '.png';

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
                    checkFinished(job);
                })
                .catch(err => logger.error(`${filename} upload failed: ${err}`));
        });
    }

    function onStderr(data) {
        const text = data.toString();
        // Filter out directory label from stack traces
        process.stdout.write(text.replace(/\.\.\.\/.*\/(main|deepforge|init).py/g, '$1'));
    }

    function onStdout(job, data) {
        const lines = data.toString().split('\n');
        const result = [];

        // Check for commands...
        for (var i = 0; i < lines.length; i++) {
            const cmdStart = lines[i].indexOf(COMMAND_PREFIX);
            if (cmdStart !== -1 && lines[i].indexOf(IMAGE) !== -1) {
                uploadImage(job, lines[i]);
            } else {
                result.push(lines[i]);
            }
        }

        process.stdout.write(result.join('\n'));
    }

    function createCacheDir(cachePath) {
        return makeIfNeeded(path.dirname(cachePath));
    }

    async function dataCachePath(cacheDir, dataInfo) {
        const relPath = await Storage.getCachePath(dataInfo, logger);
        return path.join(cacheDir, relPath);
    }

    function nop() {}
});
