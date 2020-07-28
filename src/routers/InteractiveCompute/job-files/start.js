const {spawn} = require('child_process');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const requirejs = require('requirejs');
let Message;

class InteractiveClient {
    constructor(id, host) {
        this.id = id;
        this.host = host;
        this.ws = null;
    }

    connect() {
        this.ws = new WebSocket(this.host);
        this.ws.on('open', () => this.ws.send(this.id));
        this.ws.on('message', data => this.onMessage(Message.decode(data)));
    }

    async sendMessage(type, data) {
        this.ws.send(Message.encode(type, data));
    }

    async onMessage(msg) {
        if (msg.type === Message.RUN) {
            const [cmd, ...opts] = InteractiveClient.parseCommand(msg.data);
            const subprocess = spawn(cmd, opts);
            subprocess.on('close', code => this.sendMessage(Message.COMPLETE, code));
            subprocess.stdout.on('data', data => this.sendMessage(Message.STDOUT, data));
            subprocess.stderr.on('data', data => this.sendMessage(Message.STDERR, data));
        } else if (msg.type === Message.ADD_ARTIFACT) {
            const [name, dataInfo, type, config={}] = msg.data;
            const dirs = ['artifacts', name];
            await mkdirp(...dirs);
            requirejs([
                './utils.build',
            ], (
                Utils,
            ) => {
                const {Storage} = Utils;

                async function saveArtifact() {
                    const client = await Storage.getClient(dataInfo.backend, null, config);
                    const dataPath = path.join(...dirs.concat('data'));
                    const buffer = await client.getFile(dataInfo);
                    await fs.writeFile(dataPath, buffer);
                    const filePath = path.join(...dirs.concat('__init__.py'));
                    await fs.writeFile(filePath, initFile(name, type));
                }

                this.runTask(saveArtifact);
            });
        } else if (msg.type === Message.ADD_FILE) {
            this.runTask(() => this.writeFile(msg));
        }
    }

    async writeFile(msg) {
        const [filepath, content] = msg.data;
        const dirs = path.dirname(filepath).split(path.sep);
        await mkdirp(...dirs);
        await fs.writeFile(filepath, content);
    }

    async runTask(fn) {
        let exitCode = 0;
        try {
            await fn();
        } catch (err) {
            exitCode = 1;
            console.log('Task failed with error:', err);
        }
        this.sendMessage(Message.COMPLETE, exitCode);
    }

    static parseCommand(cmd) {
        const chunks = [''];
        let quoteChar = null;
        for (let i = 0; i < cmd.length; i++) {
            const letter = cmd[i];
            const isQuoteChar = letter === '"' || letter === '\'';
            const isInQuotes = !!quoteChar;
            if (!isInQuotes && isQuoteChar) {
                quoteChar = letter;
            } else if (quoteChar === letter) {
                quoteChar = null;
            } else {
                const isNewChunk = letter === ' ' && !isInQuotes;
                if (isNewChunk) {
                    chunks.push('');
                } else {
                    const lastChunk = chunks[chunks.length - 1];
                    chunks[chunks.length - 1] = lastChunk + letter;
                }
            }
        }
        return chunks;
    }

}

async function mkdirp() {
    const dirs = Array.prototype.slice.call(arguments);
    await dirs.reduce(async (lastDirPromise, nextDir) => {
        const dir = path.join(await lastDirPromise, nextDir);
        try {
            await fs.mkdir(dir);
        } catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
        return dir;
    }, process.cwd());
}

function initFile(name, type) {
    const dataPathCode = `path.join(path.dirname(__file__), 'data')`;
    return [
        'import deepforge',
        'from os import path',
        `name = '${name}'`,
        `type = '${type}'`,
        `data = deepforge.serialization.load('${type}', open(${dataPathCode}, 'rb'))`
    ].join('\n');
}

module.exports = {InteractiveClient};

const isImportedModule = require.main !== module;
if (!isImportedModule) {
    Message = require('./message');
    const [, , SERVER_URL, ID] = process.argv;
    const client = new InteractiveClient(ID, SERVER_URL);
    client.connect();
}
