/*globals define */
define([
    '../../../config',
    'webgme',
    'plugin/util',
    'q'
], function(
    gmeConfig,
    webgme,
    PluginUtils,
    Q
) {

    var CodeGen = {
        Operation: {
            pluginId: 'GenerateJob',
            namespace: 'pipeline'
        }
    };

    const PluginManager = webgme.PluginCliManager;
    var PtrCodeGen = function() {
    };

    PtrCodeGen.prototype.getPluginManager = function() {
        if (!this.manager) {
            this.manager = new PluginManager(null, this.logger, gmeConfig);
        }
        return this.manager;
    };

    PtrCodeGen.prototype.getCodeGenPluginIdFor = function(node) {
        var base = this.core.getBase(node),
            name = this.core.getAttribute(node, 'name'),
            namespace = this.core.getNamespace(node),
            pluginId;

        //this.logger.debug(`loaded pointer target of ${ptrId}: ${ptrNode}`);
        pluginId = (this.core.getOwnRegistry(node, 'validPlugins') || '').split(' ').shift();
        //this.logger.info(`generating code for ${this.core.getAttribute(ptrNode, 'name')} using ${pluginId}`);

        if (this.core.isMetaNode(node) && CodeGen[name]) {
            pluginId = CodeGen[name].pluginId || CodeGen[name];
            namespace = CodeGen[name].namespace;
        }

        if (pluginId) {
            return {
                namespace: namespace,
                pluginId: pluginId
            };
        } else if (base) {
            return this.getCodeGenPluginIdFor(base);
        } else {
            return null;
        }
    };

    PtrCodeGen.prototype.getPtrCodeHash = function(ptrId, config={}) {
        return this.core.loadByPath(this.rootNode, ptrId)
            .then(ptrNode => {
                // Look up the plugin to use
                const info = this.getCodeGenPluginIdFor(ptrNode);

                if (info && info.pluginId) {
                    var context = {
                        namespace: info.namespace,
                        activeNode: this.core.getPath(ptrNode),
                        project: this.project,
                        commitHash: this.commitHash,
                    };

                    // Load and run the plugin
                    return this.executePlugin(info.pluginId, config, context);
                } else {
                    var metanode = this.core.getMetaType(ptrNode),
                        type = this.core.getAttribute(metanode, 'name');
                    this.logger.warn(`Could not find plugin for ${type}. Will try to proceed anyway`);
                    return null;
                }
            })
            .then(hashes => hashes[0]);  // Grab the first asset for now
    };

    PtrCodeGen.prototype.getPtrCode = function() {
        return this.getPtrCodeHash.apply(this, arguments)
            .then(hash => this.blobClient.getObjectAsString(hash));
    };

    PtrCodeGen.prototype.executePlugin = async function(pluginId, config, context) {
        const manager = this.getPluginManager();
        const result = await Q.ninvoke(
            manager,
            'executePlugin',
            pluginId,
            config,
            context
        );
        this.logger.info('Finished calling ' + pluginId);
        return result.artifacts;
    };

    return PtrCodeGen;
});
