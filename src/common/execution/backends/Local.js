define([
    './BaseExecutor',
    'blob/BlobClient',
    'child_process',
    'rimraf',
    'fs',
    'os',
    'path',
], function(
    BaseExecutor,
    BlobClient,
    childProcess,
    rimraf,
    fs,
    os,
    path,
) {
    // TODO: Show an error if not running on the server...

    const spawn = childProcess.spawn;
    const {promisify} = require.nodeRequire('util');
    const mkdir = promisify(fs.mkdir);
    const rm_rf = promisify(rimraf);
    const writeFile = promisify(fs.writeFile);
    const readFile = promisify(fs.readFile);
    const execFile = promisify(childProcess.execFile);

    // UNZIP must be available on the machine, first ensure that it exists...
    ensureHasUnzip();
    const UNZIP_EXE = '/usr/bin/unzip';  // FIXME: more platform support
    const UNZIP_ARGS = ['-o'];  // FIXME: more platform support

    const LocalExecutor = function(logger, gmeConfig) {
        BaseExecutor.apply(this, arguments);
        // FIXME: set this meaningfully!
        this.blobClient = new BlobClient({
            server: '127.0.0.1',
            serverPort: gmeConfig.server.port,
            httpsecure: false,
            logger: this.logger.fork('BlobClient')
        });
    };

    LocalExecutor.prototype = Object.create(BaseExecutor.prototype);

    //LocalExecutor.prototype.cancelJob = function(job) {
        //return this.executor.cancelJob(job.hash, job.secret);
    //};

    //LocalExecutor.prototype.getInfo = function(job) {
        //return this.executor.getInfo(job.hash);
    //};

    // TODO: Add cancel support! TODO
    LocalExecutor.prototype.createJob = async function(hash) {

        // TODO: Set up a directory to work in...
        // Create tmp directory
        const tmpdir = path.join(os.tmpdir(), `deepforge-local-exec-${hash}`);
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
        console.log('created working directory at', tmpdir);

        // Fetch the required files from deepforge
        try {
            await this.prepareWorkspace(hash, tmpdir);
        } catch (err) {
            console.log(`Error: ${err}`);
        }

        // Spin up a subprocess
        const config = JSON.parse(await readFile(tmpdir.replace(path.sep, '/') + '/executor_config.json', 'utf8'));
        console.log('config:', config);

        const env = {cwd: tmpdir};
        execJob = spawn(config.cmd, config.args, env);
        execJob.stdout.on('data', data => this.emit('data', hash, data));  // TODO: should this be stdout?
        execJob.stderr.on('data', data => this.emit('data', hash, data));
        execJob.on('close', code => {
            const jobInfo = {
                resultHashes: [],  // TODO: upload data and add result hashes 
                status: 'SUCCESS'
            }

            if (code === 0) {  // Success
                // TODO: upload data and record hashes..
            } else {
                jobInfo.status = 'FAILED_TO_EXECUTE';
            }
            this.emit('end', hash, jobInfo);
        });

        // upload the resultArtifacts
        // TODO

        //return result;
    };

    LocalExecutor.prototype.prepareWorkspace = async function(hash, dirname) {
        this.logger.info(`about to fetch job data`);
        const content = new Buffer(new Uint8Array(await this.blobClient.getObject(hash)));  // TODO: Handle errors...
        const zipPath = path.join(dirname, `${hash}.zip`);
        await writeFile(zipPath, content);
        this.logger.info(`Fetched job data: ${zipPath}`);

        this.logger.info(`unzipping ${zipPath} in ${dirname}`);
        await unzip(zipPath, dirname);
    };

    async function unzip(filename, dirname) {
        const args = UNZIP_ARGS.concat(path.basename(filename));
        console.log('running:', UNZIP_EXE, args.join(' '));
        await execFile(UNZIP_EXE, args, {cwd: dirname});

        await rm_rf(filename);
    }

    function ensureHasUnzip() {
        // FIXME: check for unzip here!
    }
    // - [ ] emit updates on stdout...

    return LocalExecutor;

});
