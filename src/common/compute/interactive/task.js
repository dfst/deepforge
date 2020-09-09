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
        constructor(channel, msg) {
            super();
            this.channel = channel;
            this.msg = msg;
        }

        async run() {
            const deferred = utils.defer();

            this.channel.send(this.msg.encode());
            const handler = async wsMsg => {
                const data = await Task.getMessageData(wsMsg);

                const msg = Message.decode(data);
                this.emitMessage(msg);
                if (msg.type === Message.COMPLETE) {
                    this.channel.unlisten(handler);
                    deferred.resolve();
                }
            };
            this.channel.listen(handler);

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
