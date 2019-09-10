define([
], function(
) {
    const BaseExecutor = function(logger, gmeConfig) {
        const isHttps = typeof window === 'undefined' ? false :
            window.location.protocol !== 'http:';

        this.logger = logger.fork('executor');
        this._events = {};
    };

    BaseExecutor.prototype.cancelJob = function(job) {
        const msg = `cancelJob is not implemented for current executor backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    BaseExecutor.prototype.getInfo = function(job) {
        const msg = `getInfo is not implemented for current executor backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    BaseExecutor.prototype.createJob = async function(hash) {
        const msg = `createJob is not implemented for current executor backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    BaseExecutor.prototype.getStatus = async function(jobInfo) {
        const msg = `getStatus is not implemented for current executor backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    BaseExecutor.prototype.getOutputHashes = async function(jobInfo) {
        const msg = `getOutputHashes is not implemented for current executor backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    // TODO: Should I remove this?
    BaseExecutor.prototype.getConsoleOutput = async function(hash) {
        const msg = `getConsoleOutput is not implemented for current executor backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
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

    // TODO: Make these match the values in the model (`status` enum on pipeline.Job)
    BaseExecutor.prototype.QUEUED = 'queued';
    BaseExecutor.prototype.PENDING = 'pending';
    BaseExecutor.prototype.RUNNING = 'running';
    BaseExecutor.prototype.SUCCESS = 'success';
    BaseExecutor.prototype.FAILED = 'failed';
    BaseExecutor.prototype.CANCELED = 'canceled';
    BaseExecutor.prototype.NOT_FOUND = 'NOT_FOUND';

    return BaseExecutor;
});
