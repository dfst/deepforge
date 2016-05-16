/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Thu Mar 10 2016 04:16:02 GMT-0600 (CST).
 */

define([
    'deepforge/layer-args',
    'deepforge/lua',
    './nn',
    'plugin/PluginBase',
    'text!./metadata.json'
], function (
    LayerDict,
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

        this.blobClient.getMetadata(srcHash)
            .then(mdata => {  // Create the new model
                var name = mdata.name.replace('.lua', '');
                this.tgtNode = this.core.createNode({
                    base: this.META.Architecture,
                    parent: this.activeNode
                });
                this.core.setAttribute(this.tgtNode, 'name', name);
                return this.blobClient.getObjectAsString(srcHash);
            })
            .then(src => {  // Retrieved the source code
                this.logger.debug('Retrieved the torch src');
                this.context = luajs.newContext();
                this.context.loadStdLib();

                this.loadNNMock();

                // Cross compile to js and run
                this.bin = this.context.loadString(src);
                this.bin();

                this.afterExecution();

                return this.save('ImportTorch updated model.');
            })
            .then(() => {  // changes saved successfully
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err =>
                callback(err, this.result)
            );
    };

    // Create the 'nn' shim and add it to the global context
    ImportTorch.prototype.loadNNMock = function () {
        // This needs a refactor...
        //   createNN(this)
        var lib = createNNSearcher(this).bind(this.context);

        // Create a "searcher" to allow this 'nn' to be in the lib path
        this.context._G.get('package').set('searchers', [function(name) {
            if (name === 'nn') {
                return lib;
            }
        }]);

        // Some scripts don't include `require 'nn'`. I may have to add the
        // "nn" package to the global scope...
    };

    ImportTorch.prototype.afterExecution = function () {
        // TODO
    };

    return ImportTorch;
});
