/* globals define */
define([
    'q',
    'superagent'
], function(
    Q,
    superagent
) {
    'use strict';

    // Wrap the ability to read, update, and delete logs using the JobLogsAPI
    var JobLogsClient = function(params) {
        params = params || {};

        this.logger = params.logger.fork('JobLogsClient');

        // Get the server url
        this.token = params.token;
        this.origin = this._getServerUrl(params);
        this.relativeUrl = '/execution/logs';
        this.url = this.origin + this.relativeUrl;

        this.logger.debug(`Setting url to ${this.url}`);

        // Get the project, branch name
        if (!(params.branchName && params.projectId)) {
            throw Error('"branchName" and "projectId" required');
        }
        this.branch = params.branchName;
        this.project = params.projectId;
        this._modifiedJobs = [];

        this.logger.debug(`Using <project>:<branch>: "${this.project}"/"${this.branch}"`);
        this.logger.info('ctor finished');
    };

    JobLogsClient.prototype._getServerUrl = function(params) {
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }

        // If not in browser, set using the params
        var server = params.server || '127.0.0.1',
            port = params.port || '80',
            protocol = params.httpsecure ? 'https' : 'http';  // default is http

        return params.origin || `${protocol}://${server}:${port}`;
    };

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

    JobLogsClient.prototype._logRequest = function(method, jobId, content) {
        var deferred = Q.defer(),
            req = superagent[method](this.getUrl(jobId));

        this.logger.info(`sending ${method} request to ${this.getUrl(jobId)}`);
        if (this.token) {
            req.set('Authorization', 'Bearer ' + this.token);
        }

        if (content) {
            req = req.send(content);
        }

        req.end((err, res) => {
            if (err || res.status > 399) {
                return deferred.reject(err || res.status);
            }

            return deferred.resolve(res);
        });

        return deferred.promise;
    };

    JobLogsClient.prototype.appendTo = function(jobId, text) {
        this._modifiedJobs.push(jobId);
        this.logger.info(`Appending logs to ${jobId}`);
        return this._logRequest('patch', jobId, {patch: text});
    };

    JobLogsClient.prototype.getLog = function(jobId) {
        this.logger.info(`Getting logs for ${jobId}`);
        return this._logRequest('get', jobId)
            .then(res => res.text);
    };

    JobLogsClient.prototype.deleteLog = function(jobId) {
        this.logger.info(`Deleting logs for ${jobId}`);
        return this._logRequest('delete', jobId);
    };

    return JobLogsClient;
});
