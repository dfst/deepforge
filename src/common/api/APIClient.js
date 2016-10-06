/*globals define*/
define([
    'q',
    'superagent'
], function(
    Q,
    superagent
) {
    'use strict';

    // Wrap the ability to read, update, and delete logs using the JobLogsAPI
    var APIClient = function(params) {
        params = params || {};

        this.logger = this.logger || params.logger.fork('APIClient');

        // Get the server url
        this.token = params.token;
        this.origin = this._getServerUrl(params);
        this.relativeUrl = this.relativeUrl || '';
        this.url = this.origin + this.relativeUrl;

        this.logger.debug(`Setting url to ${this.url}`);

        this.branch = params.branchName;
        this.project = params.projectId;
        this._modifiedJobs = [];

        this.logger.debug(`Using <project>:<branch>: "${this.project}"/"${this.branch}"`);
        this.logger.info('ctor finished');
    };

    APIClient.prototype._getServerUrl = function(params) {
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }

        // If not in browser, set using the params
        var server = params.server || '127.0.0.1',
            port = params.port || '80',
            protocol = params.httpsecure ? 'https' : 'http';  // default is http

        return params.origin || `${protocol}://${server}:${port}`;
    };

    APIClient.prototype.getUrl = function() {
        return this.url;
    };

    APIClient.prototype._request = function(method, jobId, content) {
        var deferred = Q.defer(),
            req = superagent[method](this.getUrl(jobId));

        this.logger.debug(`sending ${method} request to ${this.getUrl(jobId)}`);
        if (this.token) {
            req.set('Authorization', 'Bearer ' + this.token);
        }

        if (content) {
            req = req.send(content);
        }

        req.end((err, res) => {
            if (err || res.status > 399) {
                return deferred.reject(res || err);
            }

            return deferred.resolve(res);
        });

        return deferred.promise;
    };

    return APIClient;
});
