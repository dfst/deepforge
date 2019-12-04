/* globals define */
define([], function() {
    const ComputeClient = function(logger, blobClient) {
        this.logger = logger.fork('compute');
        this.blobClient = blobClient;
        this._events = {};
    };

    ComputeClient.prototype.cancelJob = function(/*job*/) {
        unimplemented(this.logger, 'cancelJob');
    };

    ComputeClient.prototype.createJob = async function(/*hash*/) {
        unimplemented(this.logger, 'createJob');
    };

    ComputeClient.prototype.getStatus = async function(/*jobInfo*/) {
        unimplemented(this.logger, 'getStatus');
    };

    ComputeClient.prototype.getResultsInfo = async function(/*jobInfo*/) {
        unimplemented(this.logger, 'getResultsInfo');
    };

    ComputeClient.prototype.getConsoleOutput = async function(/*hash*/) {
        unimplemented(this.logger, 'getConsoleOutput');
    };

    ComputeClient.prototype.isFinishedStatus = function(status) {
        const notFinishedStatuses = [this.QUEUED, this.PENDING, this.RUNNING];
        return !notFinishedStatuses.includes(status);
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

    function unimplemented(logger, name) {
        const msg = `${name} is not implemented for current compute backend!`;
        logger.error(msg);
        throw new Error(msg);
    }

    return ComputeClient;
});
