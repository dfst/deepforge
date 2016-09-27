/* globals define */
define([
    './APIClient'
], function(
    APIClient
) {
    'use strict';

    var JobOriginClient = function(params) {
        this.relativeUrl = '/job/origins/';
        this.logger = params.logger.fork('JobOriginClient');
        APIClient.call(this, params);
    };

    JobOriginClient.prototype = Object.create(APIClient.prototype);

    // - Record the origin
    // - Look up the origin
    // - Delete record
    JobOriginClient.prototype.getUrl = function(hash) {
        return this.url + hash;
    };

    JobOriginClient.prototype.record = function(hash, info) {
        var jobInfo = {
            hash: hash,
            nodeId: info.nodeId,
            job: info.job,
            project: info.project || this.project,
            branch: info.branch || this.branch,
            execution: info.execution
        };

        return this._request('post', hash, jobInfo)
            .catch(err => {
                throw err.text || err;
            });
    };

    JobOriginClient.prototype.getOrigin = function(hash) {
        return this._request('get', hash)
            .then(res => JSON.parse(res.text))
            .catch(res => {
                if (res.status && res.status === 404) {
                    return null;
                }
                throw res;
            });
    };

    JobOriginClient.prototype.fork = function(hash, forkName) {
        return this._request('patch', hash, {branch: forkName});
    };

    JobOriginClient.prototype.deleteRecord = function(hash) {
        return this._request('delete', hash);
    };

    return JobOriginClient;
});
