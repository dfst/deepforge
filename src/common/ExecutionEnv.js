/* globals define */
define([
    'superagent',
    'q'
], function(
    superagent,
    Q
) {
    const WORKER_ENDPOINT = '/rest/executor/worker';
    const JOBS_ENDPOINT = '/rest/executor';
    const values = dict => Object.keys(dict).map(k => dict[k]);

    const ExecutionEnv = {};

    ExecutionEnv.url = function(urlPath) {
        if (typeof window === 'undefined') {
            let gmeConfig = require('../../config');
            return `http://127.0.0.1:${gmeConfig.server.port}${urlPath}`;
        }
        return urlPath;
    };

    ExecutionEnv.get = function(urlPath) {
        const deferred = Q.defer();
        const url = this.url(urlPath);

        superagent.get(url)
            .end((err, res) => {
                if (err) {
                    return deferred.reject(err);
                }
                deferred.resolve(JSON.parse(res.text));
            });

        return deferred.promise;
    };

    ExecutionEnv.getWorkers = function() {
        return this.get(WORKER_ENDPOINT)
            .then(workerDict => values(workerDict));
    };

    ExecutionEnv.getJobs = function() {
        return this.get(JOBS_ENDPOINT);
    };

    return ExecutionEnv;
});
