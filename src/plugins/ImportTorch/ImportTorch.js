/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge/lua',
    './nn',
    'plugin/PluginBase',
    'text!./metadata.json'
], function (
    luajs,
    createNNSearcher,
    PluginBase,
    metadata
) {
    'use strict';

    /**
     * Initializes a new instance of ImportTorch.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ImportTorch.
     * @constructor
     */
    var ImportTorch = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = ImportTorch.metadata;
    };

    ImportTorch.metadata = JSON.parse(metadata);

    // Prototypal inheritance from PluginBase.
    ImportTorch.prototype = Object.create(PluginBase.prototype);
    ImportTorch.prototype.constructor = ImportTorch;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ImportTorch.prototype.main = function (callback) {
        var srcHash = this.getCurrentConfig().srcHash;

        if (!srcHash) {
            return callback('Torch code not provided.', this.result);
        }

        this.addCustomLayersToMeta();

        this.blobClient.getMetadata(srcHash)
            .then(mdata => {  // Create the new model
                // If the current node is an architecture, assume we are just extending it
                this.importedName = mdata.name.replace('.lua', '');
                if (this.isMetaTypeOf(this.activeNode, this.META.Architecture)) {
                    this.tgtNode = this.activeNode;
                } else {  // Create a new architecture
                    this.tgtNode = this.core.createNode({
                        base: this.META.Architecture,
                        parent: this.activeNode
                    });
                    this.core.setAttribute(this.tgtNode, 'name', this.importedName);
                }
                return this.blobClient.getObjectAsString(srcHash);
            })
            .then(src => {  // Retrieved the source code
                this.logger.debug('Retrieved the torch src');
                this.context = luajs.newContext();
                this.context.loadStdLib();

                this.loadNNMock();

                // Cross compile to js and run
                src = 'require \'nn\'\n' + src;  // guarantee it loads nn
                this.bin = this.context.loadString(src);
                this.bin();

                return this.save('ImportTorch updated model.');
            })
            .then(() => {  // changes saved successfully
                var name = this.importedName;
                this.result.setSuccess(true);
                this.createMessage(this.tgtNode,
                    `Successfully imported ${name} architecture`);
                callback(null, this.result);
            })
            .fail(err =>
                callback(err, this.result)
            );
    };

    ImportTorch.prototype.addCustomLayersToMeta = function () {
        // Add custom layers to the metamodel
        var metanodes = this.core.getAllMetaNodes(this.rootNode),
            name;

        Object.keys(metanodes).map(id => metanodes[id])
            .filter(node => this.core.isTypeOf(node, this.META.Layer))
            .forEach(layer => {
                name = this.core.getAttribute(layer, 'name');
                if (!this.META[name]) {
                    this.logger.debug(`Adding ${name} to the meta`);
                    this.META[name] = layer;
                }
            });
    };

    // Create the 'nn' shim and add it to the global context
    ImportTorch.prototype.loadNNMock = function () {
        // This needs a refactor...
        //   createNN(this)
        var lib = createNNSearcher(this, this.context).bind(this.context);

        // Create a "searcher" to allow this 'nn' to be in the lib path
        this.context._G.get('package').set('searchers', [function(name) {
            if (name === 'nn') {
                return lib;
            } else {
                return () => {};
            }
        }]);
    };

    return ImportTorch;
});
