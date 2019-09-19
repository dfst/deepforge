/* globals define */
define([], function() {
    const ComputeClient = function(logger) {
        this.logger = logger.fork('compute');
        this._events = {};
    };

    ComputeClient.prototype.cancelJob = function(/*job*/) {
        const msg = `cancelJob is not implemented for current compute backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    ComputeClient.prototype.getInfo = function(/*job*/) {
        const msg = `getInfo is not implemented for current compute backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    ComputeClient.prototype.createJob = async function(/*hash*/) {
        const msg = `createJob is not implemented for current compute backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    ComputeClient.prototype.getStatus = async function(/*jobInfo*/) {
        const msg = `getStatus is not implemented for current compute backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    ComputeClient.prototype.getOutputHashes = async function(/*jobInfo*/) {
        const msg = `getOutputHashes is not implemented for current compute backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    ComputeClient.prototype.getConsoleOutput = async function(/*hash*/) {
        const msg = `getConsoleOutput is not implemented for current compute backend!`;
        this.logger.warn(msg);
        throw new Error(msg);
    };

    // Some functions for event support
    ComputeClient.prototype.on = function(ev, cb) {
        this._events[ev] = this._events[ev] || [];
        this._events[ev].push(cb);
    };

    ComputeClient.prototype.emit = function(ev) {
        const args = Array.prototype.slice.call(arguments, 1);
        const handlers = this._events[ev] || [];
        handlers.forEach(fn => fn.apply(this, args));
    };

    ComputeClient.prototype.QUEUED = 'queued';
    ComputeClient.prototype.PENDING = 'pending';
    ComputeClient.prototype.RUNNING = 'running';
    ComputeClient.prototype.SUCCESS = 'success';
    ComputeClient.prototype.FAILED = 'failed';
    ComputeClient.prototype.CANCELED = 'canceled';
    ComputeClient.prototype.NOT_FOUND = 'NOT_FOUND';

    return ComputeClient;
});
