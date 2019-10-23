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

        pluginId = (this.core.getOwnRegistry(node, 'validPlugins') || '').split(' ').shift();

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

    PtrCodeGen.prototype.getPtrCodeHash = async function(ptrId, config={}) {
        const node = await this.core.loadByPath(this.rootNode, ptrId);
        const info = this.getCodeGenPluginIdFor(node);

        if (info && info.pluginId) {
            const context = {
                namespace: info.namespace,
                activeNode: this.core.getPath(node),
                project: this.project,
                commitHash: this.currentHash,
            };

            // Load and run the plugin
            const result = await this.executePlugin(info.pluginId, config, context);
            return result.artifacts[0];
        } else {
            var metanode = this.core.getMetaType(node),
                type = this.core.getAttribute(metanode, 'name');
            this.logger.warn(`Could not find plugin for ${type}. Will try to proceed anyway`);
            return null;
        }
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
        return result;
    };

    return PtrCodeGen;
});
