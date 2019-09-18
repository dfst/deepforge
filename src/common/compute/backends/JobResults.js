const ComputeClient = require('./ComputeClient');

class JobResults {
    constructor(status=ComputeClient.prototype.CREATED) {
        this.status = status;
        this.resultHashes = [];
    }
}

module.exports = JobResults;
