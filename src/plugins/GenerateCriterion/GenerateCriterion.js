/*globals define*/
/*jshint node:true, browser:true*/

define([
    'text!./metadata.json',
    'plugin/PluginBase'
], function (
    pluginMetadata,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of GenerateCriterion.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateCriterion.
     * @constructor
     */
    var GenerateCriterion = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateCriterion.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateCriterion.prototype = Object.create(PluginBase.prototype);
    GenerateCriterion.prototype.constructor = GenerateCriterion;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateCriterion.prototype.main = function (callback) {
        // Generate the code for the criterion layer and return a file
        var name = this.core.getAttribute(this.activeNode, 'name'),
            code = `require 'nn'\nreturn nn.${name}()`,
            filename = `${name}.lua`;

        // Using the logger.
        this.logger.debug(`Generating code for ${name} criterion layer.`);

        // Save the file
        this.blobClient.putFile(filename, code)
            .then(hash => {
                this.result.setSuccess(true);
                this.result.addArtifact(hash);
                callback(null, this.result);
            })
            .catch(err => callback(err, this.result));

    };

    return GenerateCriterion;
});
