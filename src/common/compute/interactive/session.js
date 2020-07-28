/* globals define */
define([
    'deepforge/utils',
    'deepforge/compute/interactive/task',
    'deepforge/compute/interactive/message',
    'deepforge/compute/interactive/errors',
    'deepforge/gmeConfig',
], function(
    utils,
    Task,
    Message,
    Errors,
    gmeConfig,
) {
    const {defer} = utils;
    const {CommandFailedError} = Errors;
    const isNodeJs = typeof window === 'undefined';
    const WebSocket = isNodeJs ? require('ws') : window.WebSocket;

    class InteractiveSession {
        constructor(computeID, config={}) {
            this.currentTask = null;
            const address = gmeConfig.extensions.InteractiveComputeHost ||
                this.getDefaultServerURL();
            this.ws = new WebSocket(address);
            this.connected = defer();
            this.ws.onopen = () => {
                this.ws.send(JSON.stringify([computeID, config, this.getGMEToken()]));
                this.ws.onmessage = async (wsMsg) => {
                    const data = await Task.getMessageData(wsMsg);

                    const msg = Message.decode(data);
                    if (msg.type === Message.COMPLETE) {
                        const err = msg.data;
                        this.ws.onmessage = null;
                        if (err) {
                            this.connected.reject(err);
                        } else {
                            this.connected.resolve();
                            this.checkReady();
                        }
                    }
                };
            };

            this.ready = null;
        }

        getDefaultServerURL() {
            const isSecure = !isNodeJs && location.protocol.includes('s');
            const protocol = isSecure ? 'wss' : 'ws';
            const defaultHost = isNodeJs ? '127.0.0.1' :
                location.origin
                    .replace(location.protocol + '//', '')
                    .replace(/:[0-9]+$/, '');
            return `${protocol}://${defaultHost}:${gmeConfig.server.port + 1}`;
        }

        getGMEToken() {
            if (isNodeJs) {
                return '';
            }

            const [, token] = (document.cookie || '').split('=');
            return token;
        }

        checkReady() {
            if (this.isIdle() && this.ready) {
                this.ready.resolve();
            }
        }

        isIdle() {
            return !this.currentTask && this.ws.readyState === WebSocket.OPEN;
        }

        ensureIdle(action) {
            if (!this.isIdle()) {
                throw new Error(`Cannot ${action} when not idle.`);
            }
        }

        spawn(cmd) {
            this.ensureIdle('spawn a task');

            const msg = new Message(Message.RUN, cmd);
            const task = new Task(this.ws, msg);
            this.runTask(task);
            return task;
        }

        async runTask(task) {
            this.ensureIdle('run task');

            this.currentTask = task;
            await task.run();
            this.currentTask = null;
            this.checkReady();
        }

        async whenConnected() {
            return this.connected.promise;
        }

        async whenReady() {
            this.ready = this.ready || defer();
            return this.ready.promise;
        }

        async exec(cmd) {
            this.ensureIdle('exec a task');
            const msg = new Message(Message.RUN, cmd);
            const task = new Task(this.ws, msg);
            const result = {
                stdout: '',
                stderr: '',
                exitCode: 0
            };
            task.on(Message.STDOUT, data => result.stdout += data.toString());
            task.on(Message.STDERR, data => result.stderr += data.toString());
            task.on(Message.COMPLETE, code => result.exitCode = code);
            await this.runTask(task);
            if (result.exitCode) {
                throw new CommandFailedError(cmd, result);
            }
            return result;
        }

        async addArtifact(name, dataInfo, type, auth) {
            this.ensureIdle('add artifact');
            const msg = new Message(Message.ADD_ARTIFACT, [name, dataInfo, type, auth]);
            const task = new Task(this.ws, msg);
            await this.runTask(task);
        }

        async addFile(filepath, content) {
            this.ensureIdle('add file');
            const msg = new Message(Message.ADD_FILE, [filepath, content]);
            const task = new Task(this.ws, msg);
            await this.runTask(task);
        }

        close() {
            this.ws.close();
        }

        static async new(computeID, config={}, SessionClass=InteractiveSession) {
            const session = new SessionClass(computeID, config);
            await session.whenConnected();
            return session;
        }
    }

    Object.assign(InteractiveSession, Message.Constants);

    return InteractiveSession;
});
