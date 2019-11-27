/* globals define */
define([
    '../ComputeClient',
    '../JobResults',
    './ExecutorHelper',
    'executor/ExecutorClient',
    'common/util/assert',
    'path',
    'module',
], function(
    ComputeClient,
    JobResults,
    ExecutorHelper,
    ExecutorClient,
    assert,
    path,
    module,
) {
    const PROJECT_ROOT = path.join(path.dirname(module.uri), '..', '..', '..', '..', '..');
    const GMEExecutor = function(/*logger*/) {
        ComputeClient.apply(this, arguments);
        const configPath = path.join(PROJECT_ROOT, 'config');
        const gmeConfig = require.nodeRequire(configPath);
        this.pollInterval = 1500;
        this.previousGMEInfo = {};
        this.executor = new ExecutorClient({
            logger: this.logger,
            serverPort: gmeConfig.server.port,
            httpsecure: false
        });
    };
    GMEExecutor.prototype = Object.create(ComputeClient.prototype);

    GMEExecutor.prototype.getConsoleOutput = async function(job) {
        const info = await this.executor.getInfo(job.hash);
        const isComplete = this.isFinishedStatus(this._getComputeStatus(info.status));

        if (isComplete) {
            const mdHash = await this._getResultHash(job, 'stdout');
            const hash = await this._getContentHash(mdHash, 'job_stdout.txt');
            assert(hash, 'Console output data not found.');
            return await this.blobClient.getObjectAsString(hash);
        } else {
            return (await this.executor.getOutput(job.hash))
                .map(o => o.output).join('');
        }
    };

    GMEExecutor.prototype.cancelJob = function(job) {
        return this.executor.cancelJob(job.hash, job.secret);
    };

    GMEExecutor.prototype._getResultHash = async function(job, name) {
        const {resultHashes} = await this.executor.getInfo(job.hash);
        return resultHashes[name];
    };

    GMEExecutor.prototype.getResultsInfo = async function(job) {
        const mdHash = await this._getResultHash(job, 'results');
        const hash = await this._getContentHash(mdHash, 'results.json');
        assert(hash, 'Metadata about result types not found.');
        return await this.blobClient.getObjectAsJSON(hash);
    };

    GMEExecutor.prototype._getContentHash = async function (artifactHash, fileName) {
        const artifact = await this.blobClient.getArtifact(artifactHash);
        const contents = artifact.descriptor.content;

        return contents[fileName] && contents[fileName].content;
    };

    GMEExecutor.prototype.getDebugFilesHash = async function(job) {
        return await this._getResultHash(job, 'debug-files');
    };

    GMEExecutor.prototype.getStatus = async function(job) {
        const info = await this.executor.getInfo(job.hash);
        return this.getJobResultsFrom(info).status;
    };

    GMEExecutor.prototype._getComputeStatus = function(gmeStatus) {
        const gmeStatusToStatus = {
            'CREATED': this.QUEUED,
            'SUCCESS': this.SUCCESS,
            'CANCELED': this.CANCELED,
            'FAILED_TO_EXECUTE': this.FAILED,
            'RUNNING': this.RUNNING,
        };
        return gmeStatusToStatus[gmeStatus] || gmeStatus;
    };

    GMEExecutor.prototype.getJobResultsFrom = function(gmeInfo) {
        const gmeStatus = gmeInfo.status;
        return new JobResults(this._getComputeStatus(gmeStatus));
    };

    GMEExecutor.prototype.getInfo = function(job) {
        return this.executor.getInfo(job.hash);
    };

    GMEExecutor.prototype.createJob = async function(hash) {
        await this.checkExecutionEnv();

        const result = await this.executor.createJob({hash});

        this.poll(hash);

        return result;
    };

    GMEExecutor.prototype.checkExecutionEnv = async function () {
        this.logger.info('Checking execution environment');
        const workers = await ExecutorHelper.getWorkers();
        if (workers.length === 0) {
            this.logger.info('Cannot execute job(s): No connected workers');
            throw new Error('No connected workers');
        }
    };

    GMEExecutor.prototype.poll = async function(id) {
        const gmeInfo = await this.executor.getInfo(id);

        // Check for new stdout. Emit 'data' with the content
        const prevInfo = this.previousGMEInfo[id] || {};
        const currentLine = prevInfo.outputNumber + 1;
        const actualLine = gmeInfo.outputNumber;
        if (actualLine !== null && actualLine >= currentLine) {
            const stdout = (await this.executor.getOutput(id, currentLine, actualLine + 1))
                .map(o => o.output).join('');
            this.emit('data', id, stdout);
        }

        if (gmeInfo.status !== prevInfo.status) {
            const results = this.getJobResultsFrom(gmeInfo);
            this.emit('update', id, results.status);
        }

        this.previousGMEInfo[id] = gmeInfo;
        if (gmeInfo.status === 'CREATED' || gmeInfo.status === 'RUNNING') {
            setTimeout(() => this.poll(id), this.pollInterval);
        } else {
            const results = this.getJobResultsFrom(gmeInfo);
            this.emit('end', id, results);
            delete this.previousGMEInfo[id];
        }
    };

    return GMEExecutor;
});
