/* globals define, requirejs */
define([
    'module',
    'q',
], function(
    module,
    Q,
) {

    const ComputeBackend = function(id, metadata) {
        const {name, dashboard, client} = metadata;
        this.id = id;
        this.name = name;
        this.dashboardPath = dashboard;
        this.clientPath = client || './Client';
    };

    ComputeBackend.prototype.getClient = function(logger) {
        if (require.isBrowser) {
            throw new Error('Compute clients cannot be loaded in the browser.');
        }

        const Client = requirejs(`deepforge/compute/backends/${this.id}/${this.clientPath}`);
        return new Client(logger);
    };

    ComputeBackend.prototype.getDashboard = async function() {
        if (this.dashboardPath) {
            const absPath = `deepforge/compute/backends/${this.id}/${this.dashboardPath}`;
            return await this.require(absPath);
        } else {
            return null;
        }
    };

    ComputeBackend.prototype.require = function(path) {  // helper for loading async
        const deferred = Q.defer();
        require([path], deferred.resolve, deferred.reject);
        return deferred.promise;
    };

    return ComputeBackend;
});
