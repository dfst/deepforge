describe('local compute', function() {
    const fsp = require('fs').promises;
    const assert = require('assert');
    const testFixture = require('../../../../../globals');
    const GeneratedFiles = testFixture.requirejs('deepforge/plugin/GeneratedFiles');
    const Compute = testFixture.requirejs('deepforge/compute/index');
    const {ComputeJob} = testFixture.requirejs('deepforge/compute/backends/ComputeJob');
    const BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend');
    const gmeConfig = testFixture.getGmeConfig();
    const blobClient = new BlobClient(gmeConfig, testFixture.logger);
    const backend = Compute.getBackend('local');
    const client = backend.getClient(testFixture.logger, blobClient);
    const utils = testFixture.requirejs('deepforge/utils');

    describe('cancelJob', function() {
        let jobInfo;

        beforeEach(async () => {
            const jobHash = await getJobHash('sleep', '10');
            const deferred = utils.defer();
            client.on('update', (hash, status) => {
                if (hash === jobHash && status === client.RUNNING) {
                    deferred.resolve();
                }
            });

            const computeJob = new ComputeJob(jobHash);
            jobInfo = await client.startJob(computeJob);
            await deferred.promise;
        });

        it('should block until canceled', async function() {
            await client.cancelJob(jobInfo);
            const status = await client.getStatus(jobInfo);
            assert.equal(status, client.CANCELED);
        });
    });

    describe('purgeJob', function() {
        let jobInfo;
        before(async () => {
            const jobHash = await getJobHash('sleep', '0.1');
            const deferred = utils.defer();
            client.on('update', (hash, status) => {
                if (hash === jobHash && status === client.RUNNING) {
                    deferred.resolve();
                }
            });

            const computeJob = new ComputeJob(jobHash);
            jobInfo = await client.startJob(computeJob);
            await deferred.promise;
        });

        it('should throw an error when accessing status on purged job', async () => {
            const {hash} = jobInfo;
            await assert.rejects(() => client.getStatus(hash));
        });

        it('should remove tmp directory', async function() {
            const dir = client._getWorkingDir();
            await assert.rejects(() => fsp.lstat(dir));
        });
    });

    async function getJobHash(cmd) {
        const config = {
            cmd, args: Array.prototype.slice.call(arguments, 1),
        };
        const files = new GeneratedFiles(blobClient);
        files.addFile('executor_config.json', JSON.stringify(config));
        return await files.save();
    }
});

