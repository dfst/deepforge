/* globals define, requirejs */
define([
    'module',
    'q',
], function(
    module,
    Q,
) {

    const ComputeBackend = function(name) {
        this.name = name;
    };

    ComputeBackend.prototype.getClient = function(logger) {
        const path = require('path');
        const dirname = path.dirname(module.uri);
        const Client = requirejs(`${dirname}/${this.name.toLowerCase()}/Client.js`);
        return new Client(logger);
    };

    ComputeBackend.prototype.getDashboard = async function() {
        return null;
    };

    ComputeBackend.prototype.require = function(path) {  // helper for loading async
        const deferred = Q.defer();
        require([path], deferred.resolve, deferred.reject);
        return deferred.promise;
    };

    return ComputeBackend;
});
