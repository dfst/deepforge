/*globals define*/
// TODO: Show an error if not running on the server...
define([
    '../../../utils',
    'common/util/assert',
    '../ComputeClient',
    '../JobResults',
    'child_process',
    'minimatch',
    'module',
    'rimraf',
    'fs',
    'os',
    'path',
], function(
    utils,
    assert,
    ComputeClient,
    JobResults,
    childProcess,
    minimatch,
    module,
    rimraf,
    fs,
    os,
    path,
) {
    const STDOUT_FILE = 'stdout.txt';
    const spawn = childProcess.spawn;
    const {promisify} = require.nodeRequire('util');
    const mkdir = promisify(fs.mkdir);
    const readdir = promisify(fs.readdir);
    const appendFile = promisify(fs.appendFile);
    const statFile = promisify(fs.stat);
    const rm_rf = promisify(rimraf);
    const writeFile = promisify(fs.writeFile);
    const readFile = promisify(fs.readFile);
    const execFile = promisify(childProcess.execFile);
    const openFile = promisify(fs.open);
    const closeFile = promisify(fs.close);

    // UNZIP must be available on the machine, first ensure that it exists...
    ensureHasUnzip();
    const UNZIP_EXE = '/usr/bin/unzip';  // FIXME: more platform support
    const UNZIP_ARGS = ['-o'];  // FIXME: more platform support
    const DEEPFORGE_ROOT = path.join(path.dirname(module.uri), '..', '..', '..', '..', '..');
    const NODE_MODULES = path.join(DEEPFORGE_ROOT, 'node_modules');
    const symlink = promisify(fs.symlink);
    const touch = async name => await closeFile(await openFile(name, 'w'));

    class LocalExecutor extends ComputeClient {
        constructor () {
            super(...arguments);

            this.jobQueue = [];
            this.currentJob = null;
            this.subprocess = null;
            this.canceled = false;
        }

        async cancelJob (jobInfo) {
            const {hash} = jobInfo;

            if (this.currentJob === hash) {
                this.canceled = true;
                this.subprocess.kill();
                await utils.waitUntil(
                    async () => this.CANCELED === await this.getStatus(jobInfo)
                );
            } else if (this.jobQueue.includes(hash)) {
                const i = this.jobQueue.indexOf(hash);
                this.jobQueue.splice(i, 1);
                this._onJobCompleted(hash, new JobResults(this.CANCELED));
            }
        }

        async getStatus (jobInfo) {
            const {hash} = jobInfo;
            if (hash === this.currentJob) {
                return this.RUNNING;
            } else if (this.jobQueue.includes(hash)) {
                return this.QUEUED;
            } else {
                return await this._getJobFile(hash, 'status.txt', 'Job Not Found');
            }
        }

        async getConsoleOutput (job) {
            const msg = 'Console output data not found.';
            return await this._getJobFile(job.hash, STDOUT_FILE, msg);
        }

        async getResultsInfo (job) {
            const msg = 'Metadata about result types not found.';
            const resultsTxt = await this._getJobFile(job.hash, 'results.json', msg);
            return JSON.parse(resultsTxt);
        }

        async _getJobFile (hash, name, notFoundMsg) {
            const filename = path.join(this._getWorkingDir(hash), name);
            try {
                return await readFile(filename, 'utf8');
            } catch (err) {
                if (err.code === 'ENOENT') {
                    throw new Error(notFoundMsg);
                }
                throw err;
            }
        }

        async createJob (hash) {
            this.jobQueue.push(hash);
            this._processNextJob();

            return {hash};
        }

        async _onJobCompleted (hash, jobResults) {
            if (hash === this.currentJob) {
                this.currentJob = null;
            }

            const tmpdir = this._getWorkingDir(hash);
            //await this._cleanDirectory(tmpdir);
            await writeFile(path.join(tmpdir, 'status.txt'), jobResults.status);

            this.emit('update', hash, jobResults.status);
            this.emit('end', hash, jobResults);
            this._processNextJob();
        }

        async _cleanDirectory (workdir) {
            const SKIP_FILES = ['results.json', STDOUT_FILE];
            const files = (await readdir(workdir))
                .filter(name => !SKIP_FILES.includes(name))
                .map(name => path.join(workdir, name));

            return Promise.all(files.map(file => rm_rf(file)));
        }

        _processNextJob () {
            if (this.currentJob) return;

            this.currentJob = this.jobQueue.shift();
            if (this.currentJob) {
                return this._createJob(this.currentJob);
            }
        }

        _getWorkingDir (hash) {
            return path.join(os.tmpdir(), `deepforge-local-exec-${hash}`);
        }

        async _createJob (hash) {
            const jobInfo = {hash};
            this.emit('update', jobInfo.hash, this.PENDING);
            const tmpdir = this._getWorkingDir(hash);
            try {
                await mkdir(tmpdir);
            } catch (err) {
                if (err.code === 'EEXIST') {
                    await rm_rf(tmpdir);
                    await mkdir(tmpdir);
                } else {
                    throw err;
                }
            }
            this.logger.info('created working directory at', tmpdir);

            // Fetch the required files from deepforge
            await this.prepareWorkspace(hash, tmpdir);

            // Spin up a subprocess
            const config = JSON.parse(await readFile(tmpdir.replace(path.sep, '/') + '/executor_config.json', 'utf8'));

            const env = process.env;
            env.DEEPFORGE_ROOT = DEEPFORGE_ROOT;
            const options = {
                cwd: tmpdir,
                env,
            };
            this.logger.info(`Running ${config.cmd} ${config.args.join(' ')}`);
            this.subprocess = spawn(config.cmd, config.args, options);
            this.emit('update', jobInfo.hash, this.RUNNING);
            this.subprocess.stdout.on('data', data => this.onConsoleOutput(tmpdir, hash, data));

            this.subprocess.on('close', async code => {
                const status = this.canceled ? this.CANCELED :
                    (code !== 0 ? this.FAILED : this.SUCCESS);

                const jobResults = new JobResults(status);
                this.canceled = false;

                this._onJobCompleted(hash, jobResults);
            });
        }

        async onConsoleOutput (workdir, hash, data) {
            const filename = path.join(workdir, STDOUT_FILE);
            appendFile(filename, data);
            this.emit('data', hash, data);
        }

        async _getAllFiles (workdir) {
            const dirs = (await readdir(workdir))
                .filter(n => !n.includes('node_modules'))
                .map(name => path.join(workdir, name));
            const files = [];

            // Read each directory
            while (dirs.length) {
                const abspath = dirs.shift();
                const isDirectory = (await statFile(abspath)).isDirectory();
                if (isDirectory) {
                    const childpaths = (await readdir(abspath))
                        .map(name => path.join(abspath, name));
                    dirs.push.apply(dirs, childpaths);
                } else {
                    files.push(abspath);
                }
            }

            return files;
        }

        async prepareWorkspace (hash, dirname) {
            this.logger.info('about to fetch job data');
            const content = new Buffer(new Uint8Array(await this.blobClient.getObject(hash)));  // TODO: Handle errors...
            const zipPath = path.join(dirname, `${hash}.zip`);
            await writeFile(zipPath, content);
            this.logger.info(`Fetched job data: ${zipPath}`);

            this.logger.info(`unzipping ${zipPath} in ${dirname}`);
            await unzip(zipPath, dirname);

            // Set up a symbolic link to the node_modules
            await symlink(NODE_MODULES, path.join(dirname, 'node_modules'));

            // Prepare for the stdout
            await touch(path.join(dirname, STDOUT_FILE));
        }
    }

    async function unzip(filename, dirname) {
        const args = UNZIP_ARGS.concat(path.basename(filename));
        await execFile(UNZIP_EXE, args, {cwd: dirname});

        await rm_rf(filename);
    }

    function ensureHasUnzip() {
        // FIXME: check for unzip here!
    }
    // - [ ] emit updates on stdout...

    return LocalExecutor;
});
