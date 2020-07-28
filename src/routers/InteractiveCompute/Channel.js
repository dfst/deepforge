/* globals requireJS */
const EventEmitter = requireJS('deepforge/EventEmitter');

class Channel extends EventEmitter {
    constructor(ws1, ws2) {
        super();
        this.ws1 = ws1;
        this.ws2 = ws2;
        this.ws1.on('message', data => this.ws2.send(data));
        this.ws2.on('message', data => this.ws1.send(data));
        this.ws1.onclose =
        this.ws2.onclose = () => this.close();
    }

    close () {
        this.ws1.close();
        this.ws2.close();
        this.emit('close');
    }
}

Channel.CLOSE = 'close';
module.exports = Channel;
