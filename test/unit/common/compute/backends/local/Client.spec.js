describe('local compute', function() {
    const assert = require('assert');
    const testFixture = require('../../../../../globals');
    const GeneratedFiles = testFixture.requirejs('deepforge/plugin/GeneratedFiles');
    const Compute = testFixture.requirejs('deepforge/compute/index');
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

            jobInfo = await client.createJob(jobHash);
            await deferred.promise;
        });

        it('should block until canceled', async function() {
            await client.cancelJob(jobInfo);
            const status = await client.getStatus(jobInfo);
            assert.equal(status, client.CANCELED);
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

