/* globals define */
define([
    './APIClient',
    'q',
    'superagent'
], function(
    APIClient,
    Q,
    superagent
) {
    'use strict';

    // Wrap the ability to read, update, and delete logs using the JobLogsAPI
    var JobLogsClient = function(params) {
        params = params || {};

        this.relativeUrl = '/execution/logs';
        this.logger = params.logger.fork('JobLogsClient');
        APIClient.call(this, params);

        // Get the project, branch name
        if (!(params.branchName && params.projectId)) {
            throw Error('"branchName" and "projectId" required');
        }

        this._modifiedJobs = [];

        this.logger.debug(`Using <project>:<branch>: "${this.project}"/"${this.branch}"`);
        this.logger.info('ctor finished');
    };

    JobLogsClient.prototype = Object.create(APIClient.prototype);

    // This method could be optimized - it could make a log of requests
    JobLogsClient.prototype.fork = function(forkName) {
        var jobIds = this._modifiedJobs,
            deferred = Q.defer(),
            url = [
                this.url,
                'migrate',
                encodeURIComponent(this.project),
                encodeURIComponent(this.branch),
                encodeURIComponent(forkName)
            ].join('/'),
            req = superagent.post(url);

        this.logger.info(`migrating ${jobIds.length} jobs from ${this.branch} to ${forkName} in ${this.project}`);
        if (this.token) {
            req.set('Authorization', 'Bearer ' + this.token);
        }

        req.send({jobs: jobIds})
            .end((err, res) => {
                if (err || res.status > 399) {
                    return deferred.reject(err || res.status);
                }

                return deferred.resolve(res);
            });

        this.branch = forkName;
        return deferred.promise;
    };

    JobLogsClient.prototype.getUrl = function(jobId) {
        return [
            this.url,
            encodeURIComponent(this.project),
            encodeURIComponent(this.branch),
            encodeURIComponent(jobId)
        ].join('/');
    };

    JobLogsClient.prototype.appendTo = function(jobId, text) {
        this._modifiedJobs.push(jobId);
        this.logger.info(`Appending logs to ${jobId}`);
        return this._request('patch', jobId, {patch: text});
    };

    JobLogsClient.prototype.getLog = function(jobId) {
        this.logger.info(`Getting logs for ${jobId}`);
        return this._request('get', jobId)
            .then(res => res.text);
    };

    JobLogsClient.prototype.deleteLog = function(jobId) {
        this.logger.info(`Deleting logs for ${jobId}`);
        return this._request('delete', jobId);
    };

    return JobLogsClient;
});
