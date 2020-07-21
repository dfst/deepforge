/* globals define, requirejs */
define([
], function(
) {

    class ComputeBackend {
        constructor (id, metadata) {
            const {name, dashboard, client} = metadata;
            this.id = id;
            this.name = name;
            this.dashboardPath = dashboard;
            this.clientPath = client || './Client';
        }

        getClient (logger, blobClient, config) {
            if (require.isBrowser) {
                throw new Error('Compute clients cannot be loaded in the browser.');
            }

            const Client = requirejs(`deepforge/compute/backends/${this.id}/${this.clientPath}`);
            return new Client(logger, blobClient, config);
        }

        async getDashboard () {
            if (this.dashboardPath) {
                const absPath = `deepforge/compute/backends/${this.id}/${this.dashboardPath}`;
                return await this.require(absPath);
            } else {
                return null;
            }
        }

        require (path) {  // helper for loading async
            return new Promise((resolve, reject) =>
                require([path], resolve, reject)
            );
        }
    }

    return ComputeBackend;
});
