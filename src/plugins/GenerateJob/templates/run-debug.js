/*
 * Script for manually running jobs locally. Run with:
 *
 *     node run-debug.js
 *
 */
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const mkdir = promisify(fs.mkdir);
const pipeline = promisify(require('stream').pipeline);
const {spawn} = require('child_process');

const Config = require('./config.json');
process.env.DEEPFORGE_HOST = Config.HOST;
const inputData = require('./input-data.json');

const requirejs = require('requirejs');
requirejs([
    './utils.build',
], function(
    Utils,
) {
    const {Storage} = Utils;
    main();

    async function main() {
        await tryMkdir(fromRelative('outputs'));
        await tryMkdir(fromRelative('artifacts'));

        const dataFetchTasks = inputData
            .map(inputData => fetchInputData.apply(null, inputData));

        await Promise.all(dataFetchTasks);

        const spawnOptions = {
            detached: true,
            stdio: [process.stdin, process.stdout, process.stderr],
            cwd: __dirname
        };
        spawn('python', [fromRelative('main.py')], spawnOptions);
    }

    function nop() {
    }

    async function fetchInputData(filename, dataInfo, config) {
        const {backend} = dataInfo;
        const client = await Storage.getClient(backend, null, config);
        const stream = await client.getFileStream(dataInfo);
        filename = fromRelative(filename);
        await writeFile(filename, stream);
    }

    function fromRelative(filename) {
        return path.join(__dirname, filename);
    }

    async function tryMkdir(filename) {
        await mkdir(filename).catch(nop);
    }

    async function writeFile(path, readStream) {
        const dstStream = fs.createWriteStream(path, {
            encoding: readStream.readableEncoding
        });
        await pipeline(readStream, dstStream);
    }

});
