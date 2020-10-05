/*globals define*/
define([
    'blob/BlobClient',
    'q',
], function(
    BlobClient,
    Q,
) {

    class UnimplementedError extends Error {
        constructor(name, className) {
            let msg = `${name} is not implemented`;
            if (className) {
                msg += ` for ${className}`;
            }
            super(msg);
        }
    }

    const CodeGen = {
        Operation: {
            pluginId: 'GenerateJob',
            namespace: 'pipeline'
        }
    };

    class CodeGeneratorBase {
        constructor(core, rootNode, logger, blobClient) {
            this.core = core;
            this.rootNode = rootNode;
            this.logger = logger;
            this.blobClient = blobClient || new BlobClient({logger});
        }

        getCodeGenPluginId (node) {
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
                return this.getCodeGenPluginId(base);
            } else {
                return null;
            }
        }

        async getCodeHash (nodeId, config={}) {
            const node = await this.core.loadByPath(this.rootNode, nodeId);
            const info = this.getCodeGenPluginId(node);

            if (info && info.pluginId) {
                // Load and run the plugin
                const context = {
                    namespace: info.namespace,
                    activeNode: nodeId,
                };
                const result = await this.executePlugin(info.pluginId, config, context);
                return result.artifacts[0];
            } else {
                var metanode = this.core.getMetaType(node),
                    type = this.core.getAttribute(metanode, 'name');
                this.logger.warn(`Could not find plugin for ${type}. Will try to proceed anyway`);
                return null;
            }
        }

        async getCode (/*nodeId, config={}*/) {
            const hash = await this.getCodeHash(...arguments);
            return await this.blobClient.getObjectAsString(hash);
        }

        async executePlugin(/*pluginId, config, context*/) {
            throw new UnimplementedError('executePlugin');
        }

        static async fromClient(client, logger) {
            const {core, rootNode} = await Q.ninvoke(client, 'getCoreInstance', logger);
            return new ClientCodeGenerator(client, rootNode, core, logger);
        }

        static fromPlugin(plugin) {
            const {core, rootNode, project, currentHash, logger} = plugin;
            const {blobClient} = plugin;
            return new CoreCodeGenerator(core, rootNode, project, currentHash, logger, blobClient);
        }
    }

    class ClientCodeGenerator extends CodeGeneratorBase {
        constructor(client, rootNode, core, logger) {
            super(core, rootNode, logger);
            this.client = client;
        }

        async executePlugin (pluginId, config, context) {
            const pluginContext = this.client.getCurrentPluginContext(pluginId);
            pluginContext.managerConfig = Object.assign(pluginContext.managerConfig, context);
            pluginContext.pluginConfig = config;
            const result = await Q.ninvoke(this.client, 'runBrowserPlugin', pluginId, pluginContext);
            return result;
        }
    }

    class CoreCodeGenerator extends CodeGeneratorBase {
        constructor(core, rootNode, project, currentHash, logger, blobClient) {
            super(core, rootNode, logger, blobClient);
            this.project = project;
            this.currentHash = currentHash;
        }

        async executePlugin (pluginId, config, context) {
            context.project = this.project;
            context.commitHash = this.currentHash;
            const manager = this.getPluginManager();
            const result = await Q.ninvoke(
                manager,
                'executePlugin',
                pluginId,
                config,
                context
            );
            return result;
        }

        getPluginManager () {
            if (!this.manager) {
                const webgme = require('webgme');
                const gmeConfig = require('deepforge/gmeConfig');
                const PluginManager = webgme.PluginCliManager;
                this.manager = new PluginManager(null, this.logger, gmeConfig);
            }
            return this.manager;
        }
    }

    return CodeGeneratorBase;
});
