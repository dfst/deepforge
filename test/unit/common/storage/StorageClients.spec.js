describe('StorageClient', async function () {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    const {promisify} = require('util');
    const requireJS = testFixture.requirejs;
    const gmeConfig = testFixture.getGmeConfig();
    const Storage = requireJS('deepforge/storage/index');
    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);
    const logger = testFixture.logger;

    let storageClients = [];
    let dataInfo = {};
    let dummyBlob;
    before(async function () {
        await server.start();
        const storageConfigs = await testFixture.getStorageConfigs();
        let storageClient;
        for (const [client, config] of Object.entries(storageConfigs)) {
            storageClient = await Storage.getClient(client, logger, config);
            storageClients.push(storageClient);
        }
        dummyBlob = Buffer.from('The quick brown fox jumps over the lazy dog');
        assert(storageClients.length === 3);
    });

    it('should find proper storage clients', function () {
        assert(storageClients.every(client => ['s3', 'sciserver-files', 'gme'].indexOf(client.id) > -1));
    });


    it('Should Perform Different Storage Operations', function () {
        describe('Storage Operations', function () {
            let dataInfo = {};
            before('PutFiles', async function () {
                for (const client of storageClients) {
                    dataInfo[client.id] = await client.putFile(
                        `${'testFolder' + Math.random() * 100000}/QuickBrownFox`, dummyBlob);
                }
            });

            storageClients.forEach(function (client) {
                it(`should run getFile for ${client.id} storage`, async function () {
                    this.timeout(5000);
                    await client.getFile(dataInfo[client.id]);
                });
            });

            after('Delete the files', async function () {
                for (const client of storageClients) {
                    await client.deleteFile(dataInfo[client.id]);
                }
            });
        });

    });

})
;