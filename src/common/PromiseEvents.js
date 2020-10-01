/*globals define*/
define([
    'deepforge/EventEmitter',
    'deepforge/utils',
], function(
    EventEmitter,
    utils,
) {
    class PromiseEvents extends Promise {
        constructor(fn) {
            super(fn);
            this.init();
        }

        static new(fn) {
            let promise;
            promise = new PromiseEvents(async function(resolve, reject) {
                await utils.yield();
                return fn.call(promise, resolve, reject);
            });
            return promise;
        }
    }

    const methods = Object.getOwnPropertyNames(EventEmitter.prototype)
        .filter(fn => !PromiseEvents.prototype[fn]);

    methods.forEach(fn => {
        PromiseEvents.prototype[fn] = EventEmitter.prototype[fn];
    });

    return PromiseEvents;
});
