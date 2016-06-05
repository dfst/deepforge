/*globals define, WebGMEGlobal*/
define([
    'q'
], function(
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

                pluginId = this.core.getRegistry(ptrNode, 'validPlugins').split(' ').shift();
                this.logger.info(`generating code for ${this.core.getAttribute(ptrNode, 'name')} using ${pluginId}`);

                var context = WebGMEGlobal.Client.getCurrentPluginContext(pluginId);

                context.managerConfig.namespace = this.core.getNamespace(metanode);
                context.managerConfig.activeNode = this.core.getPath(ptrNode);

                // Load and run the plugin
                return Q.nfcall(this.executePlugin.bind(this), pluginId, context);
            })
            .then(hashes => hashes[0]);  // Grab the first asset for now
    };

    PtrCodeGen.prototype.executePlugin = function(pluginId, config, callback) {
        // Call the Interpreter manager in a Q.ninvoke friendly way
        // I need to create a custom context for the given plugin:
        //     - Set the activeNode to the given referenced node
        //     - If the activeNode is namespaced, set META to the given namespace
        //
        // FIXME: Check if it is running in the browser or on the server
        WebGMEGlobal.Client.runBrowserPlugin(pluginId, config, (err, result) => {
            if (!result.success) {
                return callback(result.getError());
            }
            this.logger.info('Finished calling ' + pluginId);
            callback(null, result.artifacts);
        });
    };

    return PtrCodeGen;
});
