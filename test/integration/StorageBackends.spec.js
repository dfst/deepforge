/* eslint-env node, mocha */
describe('Storage Features Test', function () {
    this.timeout(10000);
    const assert = require('assert');
    const testFixture = require('../globals');
    const {promisify} = require('util');
    const {requirejs} = testFixture;
    const TEST_STORAGE = 'storageFeaturesSpec';
    const TEST_PATH = `${TEST_STORAGE}/dummyFile`;
    const TEST_BUFFER = Buffer.from('A Quick Brown Fox Jumped over a lazy Dog.');
    const logger = testFixture.logger.fork('StorageTests');
    const Storage = requirejs('deepforge/storage/index');
    const gmeConfig = testFixture.getGmeConfig();
    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);


    const storageBackends = Storage.getAvailableBackends();
    let StorageConfigs,
        client,
        clients = {};

    before(async function () {
        await server.start();
        StorageConfigs = await testFixture.getStorageConfigs();
        for (const backend of storageBackends) {
            client = await Storage.getClient(backend, logger, StorageConfigs[backend]);
            clients[backend] = client;
            const nop = () => {};
            await client.deleteDir(TEST_STORAGE).catch(nop);
        }
    });

    for (const backend of storageBackends) {
        it(`should run storageLoop using ${backend}`, async function() {
            this.retries(maxRetries(backend));
            await storageLoop(clients[backend], TEST_PATH, TEST_BUFFER);
        });
    }

    async function storageLoop(client, testPath, content) {
        const dataInfo = await client.putFile(testPath, content);
        const contentCopy = await client.getFile(dataInfo);
        assert(content.toString() === contentCopy.toString());

        await client.getCachePath(dataInfo);

        if(client.id !== 'gme') {
            const dataInfoCopy = await client.stat(testPath);
            assert(dataInfo.data.filename === dataInfoCopy.data.filename);
            assert(dataInfo.data.size === dataInfoCopy.data.size);
        } else {
            assert.rejects(client.stat(testPath), {
                name: 'Error',
                message: 'stat not implemented for WebGME Blob Storage'
            });
        }

        await client.deleteFile(dataInfo);
    }

    after(async function () {
        await server.stop();
    });

    function maxRetries(backend) {
        if (backend.includes('sciserver')) {
            return 3;
        }
        return 1;
    }
});
