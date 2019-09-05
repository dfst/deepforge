define([
], function(
) {
    const BaseExecutor = function(logger, gmeConfig) {
        const isHttps = typeof window === 'undefined' ? false :
            window.location.protocol !== 'http:';

        this.logger = logger.fork('executor');
        this._events = {};  // FIXME: there must be a better way...
    };

    BaseExecutor.prototype.cancelJob = function(job) {
        const msg = `cancelJob is not implemented for current executor backend!`;
        this.logger.warn(msg);
        return Promise.reject(new Error(msg))
    };

    BaseExecutor.prototype.getInfo = function(job) {
        const msg = `getInfo is not implemented for current executor backend!`;
        this.logger.warn(msg);
        return Promise.reject(new Error(msg))
    };

    BaseExecutor.prototype.createJob = async function(hash) {
        const msg = `createJob is not implemented for current executor backend!`;
        this.logger.warn(msg);
        return Promise.reject(new Error(msg))
    };

    BaseExecutor.prototype.getOutput = async function(hash) {
        const msg = `getOutput is not implemented for current executor backend!`;
        this.logger.warn(msg);
        return Promise.reject(new Error(msg))
    };

    // Some functions for event support
    BaseExecutor.prototype.on = function(ev, cb) {
        this._events[ev] = this._events[ev] || [];
        this._events[ev].push(cb);
    };

    BaseExecutor.prototype.emit = function(ev) {
        const args = Array.prototype.slice.call(arguments, 1);
        console.log('emitting');
        args.forEach(a => {
            if (a instanceof Buffer) {
                console.log(a.toString());
            } else {
                console.log(a);
            }
        });
        const handlers = this._events[ev] || [];
        handlers.forEach(fn => fn.apply(this, args));
    };

    return BaseExecutor;
});
