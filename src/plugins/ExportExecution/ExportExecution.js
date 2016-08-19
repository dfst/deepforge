/*globals define*/
/*jshint node:true, browser:true*/

// This plugin should export the given execution wrapped in C
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
     * Initializes a new instance of ExportExecution.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ExportExecution.
     * @constructor
     */
    var ExportExecution = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExportExecution.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ExportExecution.prototype = Object.create(PluginBase.prototype);
    ExportExecution.prototype.constructor = ExportExecution;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ExportExecution.prototype.main = function (callback) {
        callback(null, this.result);
    };

    return ExportExecution;
});
