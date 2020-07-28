/* globals requireJS */
'use strict';

const WebSocket = require('ws');
const router = require('express').Router();
const Compute = requireJS('deepforge/compute/index');
const BlobClient = requireJS('blob/BlobClient');
const Message = requireJS('deepforge/compute/interactive/message');
const InteractiveSession = require('./Session');

class ComputeBroker {
    constructor(logger) {
        this.logger = logger.fork('broker');
        this.initSessions = [];
        this.wss = null;
    }

    listen (port) {
        this.wss = new WebSocket.Server({port});

        this.wss.on('connection', ws => {
            ws.once('message', data => {
                const isClient = data.startsWith('[');
                if (isClient) {
                    this.onClientConnected(port, ws, ...JSON.parse(data));
                } else {
                    this.onWorkerConnected(ws, data);
                }
            });
        });
    }

    stop () {
        this.wss.close();
    }

    onClientConnected (port, ws, id, config, gmeToken) {
        try {
            const backend = Compute.getBackend(id);
            const blobClient = new BlobClient({
                logger: this.logger.fork('BlobClient'),
                serverPort: port-1,
                server: '127.0.0.1',
                httpsecure: false,
                webgmeToken: gmeToken
            });
            const client = backend.getClient(this.logger, blobClient, config);
            const session = new InteractiveSession(blobClient, client, ws);
            this.initSessions.push(session);
        } catch (err) {
            ws.send(Message.encode(Message.COMPLETE, err.message));
            this.logger.warn(`Error creating session: ${err}`);
            ws.close();
        }
    }

    onWorkerConnected (ws, id) {
        const index = this.initSessions.findIndex(session => session.id === id);
        if (index > -1) {
            const [session] = this.initSessions.splice(index, 1);
            session.setWorkerWebSocket(ws);
        } else {
            this.logger.warn(`Session not found for ${id}`);
            ws.close();
        }
    }
}

let broker = null;
let gmeConfig;
function initialize(middlewareOpts) {
    const logger = middlewareOpts.logger.fork('InteractiveCompute');

    gmeConfig = middlewareOpts.gmeConfig;
    broker = new ComputeBroker(logger);
    logger.debug('initializing ...');

    logger.debug('ready');
}

function start(callback) {
    broker.listen(gmeConfig.server.port + 1);
    callback();
}

function stop(callback) {
    broker.stop();
    callback();
}


module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};
