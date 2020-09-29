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
    const Constants = makeEnum('STDOUT', 'STDERR', 'RUN', 'ADD_ARTIFACT', 'KILL',
        'ADD_FILE', 'REMOVE_FILE', 'ADD_USER_DATA', 'COMPLETE', 'ERROR', 'SET_ENV',
        'SAVE_ARTIFACT', 'STATUS');

    function makeEnum() {
        const names = Array.prototype.slice.call(arguments);
        const obj = {};
        names.forEach((name, i) => obj[name] = i);
        return obj;
    }

    class Message {
        constructor(sessionID, type, data) {
            this.sessionID = sessionID;
            this.type = type;
            this.data = data;
        }

        static decode(serialized) {
            const {sessionID, type, data} = JSON.parse(serialized);
            return new Message(sessionID, type, data);
        }

        encode() {
            return Message.encode(this.sessionID, this.type, this.data);
        }

        static encode(sessionID, type, data=0) {
            if (typeof Buffer !== 'undefined' && data instanceof Buffer) {
                data = data.toString();
            }
            return JSON.stringify({sessionID, type, data});
        }
    }
    Object.assign(Message, Constants);
    Message.Constants = Constants;

    return Message;
}));
