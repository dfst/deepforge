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
    class GMEExecutor extends ComputeClient {
        constructor(logger, blobClient, config={}) {
            super(logger, blobClient, config);
            const configPath = path.join(PROJECT_ROOT, 'config');
            const gmeConfig = require.nodeRequire(configPath);
            this.pollInterval = 1500;
            this.previousGMEInfo = {};
            this.webgmeToken = config.webgmeToken;
            this.executor = new ExecutorClient({
                logger: this.logger,
                serverPort: gmeConfig.server.port,
                httpsecure: false,
                webgmeToken: this.webgmeToken,
            });
        }

        async getConsoleOutput (job) {
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
        }

        cancelJob (job) {
            return this.executor.cancelJob(job.hash, job.secret);
        }

        async _getResultHash (job, name) {
            const {resultHashes} = await this.executor.getInfo(job.hash);
            return resultHashes[name];
        }

        async getResultsInfo (job) {
            const mdHash = await this._getResultHash(job, 'results');
            const hash = await this._getContentHash(mdHash, 'results.json');
            assert(hash, 'Metadata about result types not found.');
            return await this.blobClient.getObjectAsJSON(hash);
        }

        async _getContentHash (artifactHash, fileName) {
            const artifact = await this.blobClient.getArtifact(artifactHash);
            const contents = artifact.descriptor.content;

            return contents[fileName] && contents[fileName].content;
        }

        async getStatus (job) {
            const info = await this.executor.getInfo(job.hash);
            return this.getJobResultsFrom(info).status;
        }

        _getComputeStatus (gmeStatus) {
            const gmeStatusToStatus = {
                'CREATED': this.QUEUED,
                'SUCCESS': this.SUCCESS,
                'CANCELED': this.CANCELED,
                'FAILED_TO_EXECUTE': this.FAILED,
                'RUNNING': this.RUNNING,
            };
            return gmeStatusToStatus[gmeStatus] || gmeStatus;
        }

        getJobResultsFrom (gmeInfo) {
            const gmeStatus = gmeInfo.status;
            return new JobResults(this._getComputeStatus(gmeStatus));
        }

        getInfo (job) {
            return this.executor.getInfo(job.hash);
        }

        async createJob (hash) {
            await this.checkExecutionEnv();

            const result = await this.executor.createJob({hash});

            this.poll(hash);

            return result;
        }

        async checkExecutionEnv () {
            this.logger.info('Checking execution environment');
            const workers = await ExecutorHelper.getWorkers(this.webgmeToken);
            if (workers.length === 0) {
                this.logger.info('Cannot execute job(s): No connected workers');
                throw new Error('No connected workers');
            }
        }

        async poll (id) {
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
        }
    }

    return GMEExecutor;
});
