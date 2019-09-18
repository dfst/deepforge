/* globals define */
define([
    './ComputeClient',
], function(
    ComputeClient,
) {

    class JobResults {
        constructor(status=ComputeClient.prototype.CREATED) {
            this.status = status;
            this.resultHashes = [];
        }
    }

    return JobResults;
});
