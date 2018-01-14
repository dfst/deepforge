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

    const ExecutionEnv = {};

    ExecutionEnv.url = function(urlPath) {
        if (typeof window === 'undefined') {
            return
        }
        return urlPath;
        // If in the browser, don't worry about the path
        // TODO
        // Otherwise
        // TODO
    };

    ExecutionEnv.get = function(url) {
        var deferred = Q.defer();

        // Get the actual url
        // TODO
        superagent.get(url)
            .end((err, res) => {
                if (err) {
                    console.log('ERROR', err);
                    return deferred.reject(err);
                }
                    console.log('raw response', res.text);
                deferred.resolve(JSON.parse(res.text));
            });

        return deferred.promise;
    };

    ExecutionEnv.getWorkers = function() {
        console.log('getting workers');
        return this.get(WORKER_ENDPOINT);
    };

    ExecutionEnv.getJobs = function() {
        return this.get(JOBS_ENDPOINT);
    };

    return ExecutionEnv;
});
