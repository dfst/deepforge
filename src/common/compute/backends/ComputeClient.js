/* globals define */
define([], function() {

    class ComputeClient {
        constructor (logger, blobClient) {
            this.logger = logger.fork('compute');
            this.blobClient = blobClient;
            this._events = {};
        }

        async cancelJob (/*job*/) {
            unimplemented(this.logger, 'cancelJob');
        }

        async createJob (/*hash*/) {
            unimplemented(this.logger, 'createJob');
        }

        async getStatus (/*jobInfo*/) {
            unimplemented(this.logger, 'getStatus');
        }

        async getResultsInfo (/*jobInfo*/) {
            unimplemented(this.logger, 'getResultsInfo');
        }

        async getConsoleOutput (/*hash*/) {
            unimplemented(this.logger, 'getConsoleOutput');
        }

        isFinishedStatus (status) {
            const notFinishedStatuses = [this.QUEUED, this.PENDING, this.RUNNING];
            return !notFinishedStatuses.includes(status);
        }

        // Some functions for event support
        on (ev, cb) {
            this._events[ev] = this._events[ev] || [];
            this._events[ev].push(cb);
        }

        emit (ev) {
            const args = Array.prototype.slice.call(arguments, 1);
            const handlers = this._events[ev] || [];
            return Promise.all(handlers.map(fn => fn.apply(this, args)));
        }
    }

    const Constants = {
        QUEUED: 'queued',
        PENDING: 'pending',
        RUNNING: 'running',
        SUCCESS: 'success',
        FAILED: 'failed',
        CANCELED: 'canceled',
        NOT_FOUND: 'NOT_FOUND',
    };

    Object.assign(ComputeClient, Constants);
    Object.assign(ComputeClient.prototype, Constants);

    function unimplemented(logger, name) {
        const msg = `${name} is not implemented for current compute backend!`;
        logger.error(msg);
        throw new Error(msg);
    }

    return ComputeClient;
});
