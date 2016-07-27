/*globals define, requirejs*/
define([
    'plugin/util',
    'q'
], function(
    PluginUtils,
    Q
) {
    var PtrCodeGen = function() {
    };

    PtrCodeGen.prototype.getPtrCodeHash = function(ptrId) {
        return this.core.loadByPath(this.rootNode, ptrId)
            .then(ptrNode => {
                // Look up the plugin to use
                var metanode = this.core.getMetaType(ptrNode),
                    pluginId;

                this.logger.debug(`loaded pointer target of ${ptrId}: ${ptrNode}`);
                pluginId = this.core.getRegistry(ptrNode, 'validPlugins').split(' ').shift();
                this.logger.info(`generating code for ${this.core.getAttribute(ptrNode, 'name')} using ${pluginId}`);

                var context = {
                    namespace: this.core.getNamespace(metanode),
                    activeNode: this.core.getPath(ptrNode)
                };

                // Load and run the plugin
                return this.executePlugin(pluginId, context);
            })
            .then(hashes => hashes[0]);  // Grab the first asset for now
    };

    PtrCodeGen.prototype.createPlugin = function(pluginId) {
        var deferred = Q.defer(),
            pluginPath = [
                'plugin',
                pluginId,
                pluginId,
                pluginId
            ].join('/');

        requirejs([pluginPath], Plugin => {
            var plugin = new Plugin();
            deferred.resolve(plugin);
        }, err => {
            this.logger.error(`Could not load ${pluginId}: ${err}`);
            deferred.reject(err);
        });
        return deferred.promise;
    };

    PtrCodeGen.prototype.configurePlugin = function(plugin, opts) {
        var logger = this.logger.fork(plugin.getName());

        return PluginUtils.loadNodesAtCommitHash(
            this.project,
            this.core,
            this.commitHash,
            this.logger,
            opts
        ).then(config => {
            plugin.initialize(logger, this.blobClient, this.gmeConfig);
            config.core = this.core;
            plugin.configure(config);
            return plugin;
        });
    };

    PtrCodeGen.prototype.executePlugin = function(pluginId, config) {
        return this.createPlugin(pluginId)
            .then(plugin => this.configurePlugin(plugin, config))
            .then(plugin => {
                return Q.ninvoke(plugin, 'main');
            })
            .then(result => {
                this.logger.info('Finished calling ' + pluginId);
                return result.artifacts;
            });
    };

    return PtrCodeGen;
});
