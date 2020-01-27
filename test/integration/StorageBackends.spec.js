/* eslint-env node, mocha */
describe('Storage Features Test', function () {
    this.timeout(5000);
    const testFixture = require('../globals');
    const {promisify} = require('util');
    const {requirejs} = testFixture;
    const TEST_STORAGE = 'storageFeaturesSpec';
    const logger = testFixture.logger.fork('StorageTests');
    const Storage = requirejs('deepforge/storage/index');
    const gmeConfig = testFixture.getGmeConfig();
    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);


    const storageBackends = Storage.getAvailableBackends();
    let StorageConfigs,
        client,
        clients = {},
        dataInfo;

    before(async function () {
        await server.start();
        StorageConfigs = await testFixture.getStorageConfigs();
        for (const backend of storageBackends) {
            client = await Storage.getClient(backend, logger, StorageConfigs[backend]);
            clients[backend] = client;
            const nop = () => {
            };
            await client.deleteDir(TEST_STORAGE).catch(nop);
        }
    });

    for (const backend of storageBackends) {
        it(`Should execute putFile operation for the storage backend ${backend} `, async () => {
            dataInfo = await clients[backend].putFile(`${TEST_STORAGE}/dummyFile`,
                Buffer.from('A Quick Brown Fox Jumped over a lazy Dog.'));
        });

        it(`Should execute getFile operation for the storage backend ${backend}`, async () => {
            await clients[backend].getFile(dataInfo);
        });

        it(`Should execute getCachePath operation for the storage backend ${backend}`, async () => {
            await clients[backend].getCachePath(dataInfo);
        });

        it(`Should execute deleteFile Operation for the storage backend ${backend}`, async () => {
            await clients[backend].deleteFile(dataInfo);
        });
    }


    after(async function () {
        await server.stop();
    });
});