/* globals define */
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define([], function(){
            return (root.utils = factory());
        });
    } else if(typeof module === 'object' && module.exports) {
        module.exports = (root.utils = factory());
    }
}(this, function() {
    const Constants = makeEnum('STDOUT', 'STDERR', 'RUN', 'ADD_ARTIFACT',
        'ADD_FILE', 'ADD_USER_DATA', 'COMPLETE', 'ERROR');

    function makeEnum() {
        const names = Array.prototype.slice.call(arguments);
        const obj = {};
        names.forEach((name, i) => obj[name] = i);
        return obj;
    }

    class Message {
        constructor(type, data) {
            this.type = type;
            this.data = data;
        }

        static decode(serialized) {
            const {type, data} = JSON.parse(serialized);
            return new Message(type, data);
        }

        encode() {
            return Message.encode(this.type, this.data);
        }

        static encode(type, data=0) {
            if (typeof Buffer !== 'undefined' && data instanceof Buffer) {
                data = data.toString();
            }
            return JSON.stringify({type, data});
        }
    }
    Object.assign(Message, Constants);
    Message.Constants = Constants;

    return Message;
}));
