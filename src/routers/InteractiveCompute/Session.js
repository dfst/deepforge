/* globals requireJS */
const WebSocket = require('ws');
const JobFiles = require('./job-files');
const chance = require('chance')();
const gmeConfig = requireJS('deepforge/gmeConfig');
const SERVER_URL = gmeConfig.extensions.InteractiveComputeHost ||
    `http://localhost:${gmeConfig.server.port + 1}`;
const Channel = require('./Channel');
const EventEmitter = requireJS('deepforge/EventEmitter');
const Message = requireJS('deepforge/compute/interactive/message');
const ComputeClient = requireJS('deepforge/compute/backends/ComputeClient');

class Session extends EventEmitter {
    constructor(blobClient, compute, clientSocket) {
        super();
        this.compute = compute;
        this.clientSocket = clientSocket;
        this.id = chance.guid();
        this.wsChannel = null;
        this.initialize(blobClient);
    }

    setWorkerWebSocket(socket) {
        this.workerSocket = socket;
        this.emit('connected');

        this.clientSocket.send(Message.encode(Message.COMPLETE));
        this.queuedMsgs.forEach(msg => this.workerSocket.send(msg));
        this.wsChannel = new Channel(this.clientSocket, this.workerSocket);
        this.wsChannel.on(Channel.CLOSE, () => this.close());
    }

    async initialize(blobClient) {
        this.queuedMsgs = [];
        this.clientSocket.on('message', data => this.queuedMsgs.push(data));

        const files = new JobFiles(blobClient, SERVER_URL, this.id);
        const hash = await files.upload();
        this.jobInfo = this.compute.createJob(hash);
        this.compute.on('end', (id, info) => {
            const isError = this.clientSocket.readyState === WebSocket.OPEN &&
                info.status !== ComputeClient.SUCCESS;
            if (isError) {
                this.clientSocket.send(Message.encode(Message.ERROR, info));
            }
        });
    }

    async close () {
        await this.compute.cancelJob(await this.jobInfo);
    }
}

module.exports = Session;
