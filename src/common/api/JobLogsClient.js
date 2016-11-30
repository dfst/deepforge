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
    var METADATA_FIELDS = [
        'lineCount'
    ];
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
        var url = this.url;
            
        if (typeof jobId !== 'string') {
            url = this.url + jobId.route;
            jobId = jobId.jobId;
        }

        return [
            url,
            encodeURIComponent(this.project),
            encodeURIComponent(this.branch),
            encodeURIComponent(jobId)
        ].join('/');
    };

    var hasRequiredFields = function(md) {
        return METADATA_FIELDS.reduce((passing, nextField) => {
            return passing && md.hasOwnProperty(nextField);
        }, true);
    };

    JobLogsClient.prototype.appendTo = function(jobId, text, metadata) {
        this._modifiedJobs.push(jobId);
        this.logger.info(`Appending logs to ${jobId}`);

        if (metadata && !hasRequiredFields(metadata)) {
            throw Error(`Required metadata fields: ${METADATA_FIELDS.join(', ')}`);
        }
        metadata = metadata || {};
        metadata.patch = text;
        return this._request('patch', jobId, metadata);
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

    JobLogsClient.prototype.getMetadata = function(jobId) {
        this.logger.info(`Getting line count for ${jobId}`);
        return this._request('get', {jobId: jobId, route: '/metadata'})
            .then(res => JSON.parse(res.text));
    };

    return JobLogsClient;
});
