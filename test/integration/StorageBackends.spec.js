/* eslint-env node, mocha */
describe('Storage Features Test', function () {
    this.timeout(5000);
    const assert = require('assert');
    const fs = require('fs');
    const testFixture = require('../globals');
    const {promisify} = require('util');
    let {Writable, pipeline} = require('stream');
    pipeline = promisify(pipeline);
    const {requirejs} = testFixture;
    const TEST_STORAGE = 'storageFeaturesSpec';
    const TEST_PATH = `${TEST_STORAGE}/dummyFile`;
    const TEST_FILE_NAME = 'TestFile';
    const CONTENT = 'A Quick Brown Fox Jumped over a lazy Dog';
    const logger = testFixture.logger.fork('StorageTests');
    const Storage = requirejs('deepforge/storage/index');
    const gmeConfig = testFixture.getGmeConfig();
    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);
    const { StringDecoder } =require('string_decoder');


    const storageBackends = Storage.getAvailableBackends();
    let StorageConfigs,
        client,
        clients = {},
        dataInfoBuffer,
        dataInfoStream;

    before(async function () {
        await server.start();
        fs.writeFileSync(TEST_FILE_NAME, CONTENT);
        StorageConfigs = await testFixture.getStorageConfigs();
        for (const backend of storageBackends) {
            client = await Storage.getClient(backend, logger, StorageConfigs[backend]);
            clients[backend] = client;
            const nop = () => {};
            await client.deleteDir(TEST_STORAGE).catch(nop);
        }
    });

    for (const backend of storageBackends) {
        it(`should putFile using ${backend}`, async function() {
            this.retries(maxRetries(backend));
            dataInfoBuffer = await clients[backend].putFile(TEST_PATH,
                Buffer.from(CONTENT));
        });

        it(`should getFile using ${backend}`, async function() {
            this.retries(maxRetries(backend));
            await clients[backend].getFile(dataInfoBuffer);
        });

        it(`should getCachePath using ${backend}`, async () => {
            await clients[backend].getCachePath(dataInfoBuffer);
        });

        it(`should stat file using ${backend}`, async () => {
            if(backend !== 'gme'){
                await clients[backend].stat(TEST_PATH);
            } else {
                assert.rejects(clients[backend].stat(TEST_PATH), {
                    name: 'Error',
                    message: 'stat not implemented for WebGME Blob Storage'
                });
            }
        });

        it(`should putFileStream using ${backend}`, async function () {
            this.retries(maxRetries([backend]));
            const stream = fs.createReadStream(TEST_FILE_NAME);
            const pathInStorageBackend = `${TEST_STORAGE}/${TEST_FILE_NAME}`;
            dataInfoStream = await clients[backend].putFileStream(pathInStorageBackend, stream);
        });

        it(`should getFileStream using ${backend}`, async function () {
            this.retries(maxRetries([backend]));
            const inputStream = await clients[backend].getFileStream(dataInfoStream);
            await verifyStreamContent(inputStream);
        });

        it(`should deleteFile using ${backend}`, async function() {
            this.retries(maxRetries(backend));
            await clients[backend].deleteFile(dataInfoBuffer);
            await clients[backend].deleteFile(dataInfoStream);
        });
    }

    after(async function () {
        fs.unlinkSync(TEST_FILE_NAME);
        await server.stop();
    });

    function maxRetries(backend) {
        if (backend.includes('sciserver')) {
            return 3;
        }
        return 1;
    }

    async function verifyStreamContent(inputStream) {
        const outputStream = new StringWritable();
        await pipeline(inputStream, outputStream);
        assert(outputStream.data === CONTENT);
    }

    class StringWritable extends Writable {
        constructor(options) {
            super(options);
            this._decoder = new StringDecoder(options && options.defaultEncoding);
            this.data = '';
        }
        _write(chunk, encoding, callback) {
            if (encoding === 'buffer') {
                chunk = this._decoder.write(chunk);
            }
            this.data += chunk;
            callback();
        }
        _final(callback) {
            this.data += this._decoder.end();
            callback();
        }
    }
});
