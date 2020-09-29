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
    let numSessions = 1;

    class InteractiveSession {
        constructor(channel) {
            this.currentTask = null;
            this.id = numSessions++;
            this.channel = channel;
            this.channel.onClientConnect(this.id);
        }

        checkReady() {
            if (this.isIdle() && this.ready) {
                this.ready.resolve();
            }
        }

        isIdle() {
            return !this.currentTask && this.channel.isOpen();
        }

        ensureIdle(action) {
            if (!this.isIdle()) {
                throw new Error(`Cannot ${action} when not idle.`);
            }
        }

        spawn(cmd) {
            this.ensureIdle('spawn a task');

            const msg = new Message(this.id, Message.RUN, cmd);
            const task = new Task(this.channel, msg);
            this.runTask(task);
            return task;
        }

        async runTask(task) {
            this.ensureIdle('run task');

            this.currentTask = task;
            const result = await task.run();
            this.currentTask = null;
            this.checkReady();
            return result;
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
            const msg = new Message(this.id, Message.RUN, cmd);
            const task = new Task(this.channel, msg);
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
            auth = auth || {};
            this.ensureIdle('add artifact');
            const msg = new Message(this.id, Message.ADD_ARTIFACT, [name, dataInfo, type, auth]);
            const task = new Task(this.channel, msg);
            await this.runTask(task);
        }

        async saveArtifact(/*path, name, storageId, config*/) {
            this.ensureIdle('save artifact');
            const msg = new Message(this.id, Message.SAVE_ARTIFACT, [...arguments]);
            const task = new Task(this.channel, msg);
            const [exitCode, dataInfo] = await this.runTask(task);
            if (exitCode) {
                throw new CommandFailedError('saveArtifact', {exitCode});
            }
            return dataInfo;
        }

        async addFile(filepath, content) {
            this.ensureIdle('add file');
            const msg = new Message(this.id, Message.ADD_FILE, [filepath, content]);
            const task = new Task(this.channel, msg);
            await this.runTask(task);
        }

        async removeFile(filepath) {
            this.ensureIdle('remove file');
            const msg = new Message(this.id, Message.REMOVE_FILE, [filepath]);
            const task = new Task(this.channel, msg);
            await this.runTask(task);
        }

        async setEnvVar(name, value) {
            this.ensureIdle('set env var');
            const msg = new Message(this.id, Message.SET_ENV, [name, value]);
            const task = new Task(this.channel, msg);
            await this.runTask(task);
        }

        async kill(task) {
            assert(
                task.msg.type === Message.RUN,
                'Cannot kill task. Must be a RUN task.'
            );
            if (task === this.currentTask) {
                const msg = new Message(this.id, Message.KILL, task.msg.data);
                const killTask = new Task(this.channel, msg);
                await killTask.run();
                this.checkReady();
            }
        }

        async forkAndRun(fn) {
            const session = this.fork();
            try {
                const result = await fn(session);
                session.close();
                return result;
            } catch (err) {
                session.close();
                throw err;
            }
        }

        close() {
            this.channel.onClientExit(this.id);
        }

        fork() {
            const Session = this.constructor;
            return new Session(this.channel);
        }

        static new(computeID, config={}, SessionClass=InteractiveSession) {
            const address = gmeConfig.extensions.InteractiveComputeHost ||
                getDefaultServerURL();

            let createSession;
            createSession = new PromiseEvents(function(resolve, reject) {
                const ws = new WebSocket(address);
                ws.onopen = () => {
                    ws.send(JSON.stringify([computeID, config, getGMEToken()]));
                    ws.onmessage = async (wsMsg) => {
                        const data = await Task.getMessageData(wsMsg);

                        const msg = Message.decode(data);
                        if (msg.type === Message.COMPLETE) {
                            const err = msg.data;
                            if (err) {
                                reject(err);
                            } else {
                                const channel = new MessageChannel(ws);
                                const session = new SessionClass(channel);
                                resolve(session);
                            }
                        } else if (msg.type === Message.ERROR) {
                            const err = msg.data;
                            reject(err);
                        } else if (msg.type === Message.STATUS) {
                            createSession.emit('update', msg.data);
                        }
                    };
                };
            });

            return createSession;
        }
    }

    class PromiseEvents extends Promise {
        constructor(fn) {
            super(fn);
            this._handlers = {};
        }

        on(event, fn) {
            if (!this._handlers[event]) {
                this._handlers[event] = [];
            }
            this._handlers[event].push(fn);
        }

        emit(event) {
            const handlers = this._handlers[event] || [];
            const args = Array.prototype.slice.call(arguments, 1);
            handlers.forEach(fn => fn.apply(null, args));
        }
    }

    function getDefaultServerURL() {
        const isSecure = !isNodeJs && location.protocol.includes('s');
        const protocol = isSecure ? 'wss' : 'ws';
        const defaultHost = isNodeJs ? '127.0.0.1' :
            location.origin
                .replace(location.protocol + '//', '')
                .replace(/:[0-9]+$/, '');
        return `${protocol}://${defaultHost}:${gmeConfig.server.port + 1}`;
    }

    function getGMEToken() {
        if (isNodeJs) {
            return '';
        }

        const [, token] = (document.cookie || '').split('=');
        return token;
    }

    function assert(cond, msg) {
        if (!cond) {
            throw new Error(msg);
        }
    }

    Object.assign(InteractiveSession, Message.Constants);

    class MessageChannel {
        constructor(ws) {
            this.ws = ws;
            this.listeners = [];

            this.ws.onmessage = message => {
                this.listeners.forEach(fn => fn(message));
            };
            this.clients = [];
        }

        send(data) {
            this.ws.send(data);
        }

        listen(fn) {
            this.listeners.push(fn);
        }

        unlisten(fn) {
            const index = this.listeners.indexOf(fn);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        }

        isOpen() {
            return this.ws.readyState === WebSocket.OPEN;
        }

        onClientConnect(id) {
            this.clients.push(id);
        }

        onClientExit(id) {
            const index = this.clients.indexOf(id);
            if (index === -1) {
                throw new Error(`Client not found: ${id}`);
            }
            this.clients.splice(index, 1);

            if (this.clients.length === 0) {
                this.ws.close();
            }
        }
    }

    return InteractiveSession;
});
