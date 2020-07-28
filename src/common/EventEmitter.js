/* globals define */
define([
], function(
) {
    class EventEmitter {
        constructor() {
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
        // TODO: Can I make this an official stream in node?
    }

    return EventEmitter;
});
