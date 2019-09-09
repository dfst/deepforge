define([
    './BaseExecutor',
    'blob/BlobClient',
    'child_process',
    'minimatch',
    'module',
    'rimraf',
    'fs',
    'os',
    'path',
], function(
    BaseExecutor,
    BlobClient,
    childProcess,
    minimatch,
    module,
    rimraf,
    fs,
    os,
    path,
) {
    // TODO: Show an error if not running on the server...

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
    const PROJECT_ROOT = path.join(path.dirname(module.uri), '..', '..', '..', '..');
    const NODE_MODULES = path.join(PROJECT_ROOT, 'node_modules');  // TODO
    const symlink = promisify(fs.symlink);
    const touch = async name => await closeFile(await openFile(name, 'w'));

    const LocalExecutor = function(logger, gmeConfig) {
        BaseExecutor.apply(this, arguments);
        this.jobQueue = [];
        this.currentJob = null;
        this.subprocess = null;
        // FIXME: set this meaningfully!
        this.blobClient = new BlobClient({
            server: '127.0.0.1',
            serverPort: gmeConfig.server.port,
            httpsecure: false,
            logger: this.logger.fork('BlobClient')
        });
    };

    LocalExecutor.prototype = Object.create(BaseExecutor.prototype);

    LocalExecutor.prototype.cancelJob = function(jobInfo) {
        const {hash} = jobInfo;

        console.log('>>> CANCELING job!!');
        if (this.currentJob === hash) {
            this.subprocess.kill();
        } else if (this.jobQueue.includes(hash)) {
            const i = this.jobQueue.indexOf(hash);
            this.jobQueue.splice(i, 1);
        }
    };

    LocalExecutor.prototype.getOutput = async function(hash) {
        const filename = path.join(this._getWorkingDir(hash), 'job_stdout.txt');
        return await readFile(filename, 'utf8');
    };

    LocalExecutor.prototype.createJob = async function(hash) {
        this.jobQueue.push(hash);
        this._processNextJob();

        console.log('>>> CREATING job!!');
        return {hash};
    };

    LocalExecutor.prototype._onJobCompleted = function() {
        this.currentJob = null;
        this._processNextJob();
    };

    LocalExecutor.prototype._processNextJob = function() {
        if (this.currentJob) return;

        this.currentJob = this.jobQueue.shift();
        if (this.currentJob) {
            return this._createJob(this.currentJob);
        }
    };

    LocalExecutor.prototype._getWorkingDir = function(hash) {
        return path.join(os.tmpdir(), `deepforge-local-exec-${hash}`);
    };

    LocalExecutor.prototype._createJob = async function(hash) {
        // Create tmp directory
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

        const env = {cwd: tmpdir};
        this.logger.info(`Running ${config.cmd} ${config.args.join(' ')}`);
        this.subprocess = spawn(config.cmd, config.args, env);
        this.subprocess.stdout.on('data', data => this.onConsoleOutput(tmpdir, hash, data));

        this.subprocess.on('close', async code => {
            const jobInfo = {
                resultHashes: [],
                status: code !== 0 ? 'FAILED_TO_EXECUTE' : 'SUCCESS'
            }

            await this._uploadResults(jobInfo, tmpdir, config);
            this._onJobCompleted();
            this.emit('end', hash, jobInfo);
        });
    };

    LocalExecutor.prototype.onConsoleOutput = async function(workdir, hash, data) {
        const filename = path.join(workdir, 'job_stdout.txt');
        appendFile(filename, data);
        this.logger.info('stdout:', data);
        this.emit('data', hash, data);
    };

    LocalExecutor.prototype._getAllFiles = async function(workdir) {
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
    };

    LocalExecutor.prototype._uploadResults = async function(jobInfo, directory, executorConfig) {
        var self = this,
            i,
            jointArtifact = self.blobClient.createArtifact('jobInfo_resultSuperSetHash'),
            resultsArtifacts = [],
            afterWalk,
            archiveFile,
            afterAllFilesArchived,
            addObjectHashesAndSaveArtifact;

        jobInfo.resultHashes = {};

        for (i = 0; i < executorConfig.resultArtifacts.length; i += 1) {
            resultsArtifacts.push(
                {
                    name: executorConfig.resultArtifacts[i].name,
                    artifact: self.blobClient.createArtifact(executorConfig.resultArtifacts[i].name),
                    patterns: executorConfig.resultArtifacts[i].resultPatterns instanceof Array ?
                        executorConfig.resultArtifacts[i].resultPatterns : [],
                    files: {}
                }
            );
        }

        afterWalk = function (filesToArchive) {
            if (filesToArchive.length === 0) {
                self.logger.info(jobInfo.hash + ' There were no files to archive..');
            }

            return Promise.all(filesToArchive.map(f => archiveFile(f.filename, f.filePath)));
        };

        archiveFile = promisify(function (filename, filePath, callback) {
            var archiveData = function (err, data) {
                jointArtifact.addFileAsSoftLink(filename, data, function (err, hash) {
                    var j;
                    if (err) {
                        self.logger.error(jobInfo.hash + ' Failed to archive as "' + filename + '" from "' +
                            filePath + '", err: ' + err);
                        self.logger.error(err);
                        callback(new Error('FAILED_TO_ARCHIVE_FILE'));
                    } else {
                        // Add the file-hash to the results artifacts containing the filename.
                        for (j = 0; j < resultsArtifacts.length; j += 1) {
                            if (resultsArtifacts[j].files[filename] === true) {
                                resultsArtifacts[j].files[filename] = hash;
                            }
                        }
                        callback(null);
                    }
                });
            };

            if (typeof File === 'undefined') { // nodejs doesn't have File
                fs.readFile(filePath, function (err, data) {
                    if (err) {
                        self.logger.error(jobInfo.hash + ' Failed to archive as "' + filename + '" from "' + filePath +
                            '", err: ' + err);
                        return callback(new Error('FAILED_TO_ARCHIVE_FILE'));
                    }
                    archiveData(null, data);
                });
            } else {
                archiveData(null, new File(filePath, filename));
            }
        });

        afterAllFilesArchived = async function () {
            let resultHash = null;
            try {
                resultHash = await jointArtifact.save();
            } catch (err) {
                this.logger.warn(`Failed to save joint artifact: ${err} (${jobInfo.hash})`);
                throw new Error('FAILED_TO_SAVE_JOINT_ARTIFACT');
            }

            try {
                await rm_rf(directory);
            } catch (err) {
                self.logger.error('Could not delete executor-temp file, err: ' + err);
            }
            jobInfo.resultSuperSetHash = resultHash;
            return Promise.all(resultsArtifacts.map(r => addObjectHashesAndSaveArtifact(r)))
        };

        addObjectHashesAndSaveArtifact = promisify(function (resultArtifact, callback) {
            resultArtifact.artifact.addMetadataHashes(resultArtifact.files, function (err/*, hashes*/) {
                if (err) {
                    self.logger.error(jobInfo.hash + ' ' + err);
                    return callback('FAILED_TO_ADD_OBJECT_HASHES');
                }
                resultArtifact.artifact.save(function (err, resultHash) {
                    if (err) {
                        self.logger.error(jobInfo.hash + ' ' + err);
                        return callback('FAILED_TO_SAVE_ARTIFACT');
                    }
                    jobInfo.resultHashes[resultArtifact.name] = resultHash;
                    callback(null);
                });
            });
        });

        const allFiles = await this._getAllFiles(directory);

        const filesToArchive = [];
        let archive,
            filename,
            matched;

        for (let i = 0; i < allFiles.length; i += 1) {
            filename = path.relative(directory, allFiles[i]).replace(/\\/g, '/');
            archive = false;
            for (let a = 0; a < resultsArtifacts.length; a += 1) {
                if (resultsArtifacts[a].patterns.length === 0) {
                    resultsArtifacts[a].files[filename] = true;
                    archive = true;
                } else {
                    for (let j = 0; j < resultsArtifacts[a].patterns.length; j += 1) {
                        matched = minimatch(filename, resultsArtifacts[a].patterns[j]);
                        if (matched) {
                            resultsArtifacts[a].files[filename] = true;
                            archive = true;
                            break;
                        }
                    }
                }
            }
            if (archive) {
                filesToArchive.push({filename: filename, filePath: allFiles[i]});
            }
        }

        try {
            await afterWalk(filesToArchive);
            return await afterAllFilesArchived();
        } catch (err) {
            jobInfo.status = err.message;
        }
    };

    //LocalExecutor.prototype._uploadResults = async function(workdir, config) {
        //// Get all the matching result artifacts
        //const allFiles = await this._getAllFiles(workdir);
        //console.log(allFiles)

        //// Upload all the artifacts
        //const artifacts = config.resultArtifacts
            //.map(info => {
                //return {
                    //name: info.name,
                    //artifact: self.blobClient.createArtifact(info.name),
                    //patterns: info.resultPatterns instanceof Array ?
                        //info.resultPatterns : [],
                    //files: {}
                //}
            //})
        //// TODO

        //// Return the hashes
        //// TODO
        //return {};
    //};

    LocalExecutor.prototype.prepareWorkspace = async function(hash, dirname) {
        this.logger.info(`about to fetch job data`);
        const content = new Buffer(new Uint8Array(await this.blobClient.getObject(hash)));  // TODO: Handle errors...
        const zipPath = path.join(dirname, `${hash}.zip`);
        await writeFile(zipPath, content);
        this.logger.info(`Fetched job data: ${zipPath}`);

        this.logger.info(`unzipping ${zipPath} in ${dirname}`);
        await unzip(zipPath, dirname);

        // Set up a symbolic link to the node_modules
        await symlink(NODE_MODULES, path.join(dirname, 'node_modules'));

        // Prepare for the stdout
        await touch(path.join(dirname, 'job_stdout.txt'));
    };

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
