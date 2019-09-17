const BaseExecutor = require('./BaseExecutor');

class JobResults {
    constructor(status=BaseExecutor.prototype.CREATED) {
        this.status = status;
        this.resultHashes = [];
    }
}

module.exports = JobResults;
