/* globals define */
define([
    'deepforge/EventEmitter',
    'deepforge/compute/interactive/message',
    'deepforge/utils',
], function(
    EventEmitter,
    Message,
    utils,
) {

    const isNodeJs = typeof window === 'undefined';
    class Task extends EventEmitter {
        constructor(ws, msg) {
            super();
            this.ws = ws;
            this.msg = msg;
        }

        async run() {
            const deferred = utils.defer();

            this.ws.send(this.msg.encode());
            this.ws.onmessage = async wsMsg => {
                const data = await Task.getMessageData(wsMsg);

                const msg = Message.decode(data);
                this.emitMessage(msg);
                if (msg.type === Message.COMPLETE) {
                    this.ws.onmessage = null;
                    deferred.resolve();
                }
            };

            return deferred.promise;
        }

        emitMessage(msg) {
            this.emit(msg.type, msg.data);
        }

        static async getMessageData(wsMsg) {
            if (isNodeJs) {
                return wsMsg.data;
            }

            const data = wsMsg.data instanceof Blob ?
                await wsMsg.data.text() : wsMsg.data;
            return data;
        }

    }

    return Task;
});
