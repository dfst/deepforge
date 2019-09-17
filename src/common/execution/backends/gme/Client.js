/* globals define */
define([
    '../BaseExecutor',
    '../JobResults',
    'deepforge/ExecutionEnv',
    'executor/ExecutorClient',
    'path',
    'module',
], function(
    BaseExecutor,
    JobResults,
    ExecutionEnv,
    ExecutorClient,
    path,
    module,
) {
    const PROJECT_ROOT = path.join(path.dirname(module.uri), '..', '..', '..', '..', '..');
    const GMEExecutor = function(/*logger*/) {
        BaseExecutor.apply(this, arguments);
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
    GMEExecutor.prototype = Object.create(BaseExecutor.prototype);

    GMEExecutor.prototype.getConsoleOutput = async function(hash) {
        return (await this.executor.getOutput(hash))
            .map(o => o.output).join('');
    };

    GMEExecutor.prototype.cancelJob = function(job) {
        return this.executor.cancelJob(job.hash, job.secret);
    };

    GMEExecutor.prototype.getOutputHashes = async function(job) {
        return (await this.executor.getInfo(job.hash)).resultHashes;
    };

    GMEExecutor.prototype.getStatus = async function(job) {
        const info = await this.executor.getInfo(job.hash);
        return this.getJobResultsFrom(info).status;
    };

    GMEExecutor.prototype.getJobResultsFrom = function(gmeInfo) {
        const gmeStatus = gmeInfo.status;
        const gmeStatusToStatus = {
            'CREATED': this.QUEUED,
            'SUCCESS': this.SUCCESS,
            'CANCELED': this.CANCELED,
            'FAILED_TO_EXECUTE': this.FAILED,
            'RUNNING': this.RUNNING,
        };
        return new JobResults(gmeStatusToStatus[gmeStatus] || gmeStatus);
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
        this.logger.info(`Checking execution environment`);
        const workers = await ExecutionEnv.getWorkers();
        if (workers.length === 0) {
            this.logger.info(`Cannot execute job(s): No connected workers`);
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
