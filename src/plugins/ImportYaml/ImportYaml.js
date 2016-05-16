/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Fri Apr 08 2016 19:50:34 GMT-0500 (CDT).
 */

define([
    'deepforge/GraphChecker',
    'plugin/PluginBase',
    'text!./metadata.json'
], function (
    GraphChecker,
    PluginBase,
    metadata
) {
    'use strict';

    /**
     * Initializes a new instance of ImportYaml.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ImportYaml.
     * @constructor
     */
    var ImportYaml = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = ImportYaml.metadata;
    };

    ImportYaml.metadata = JSON.parse(metadata);
    // Prototypal inheritance from PluginBase.
    ImportYaml.prototype = Object.create(PluginBase.prototype);
    ImportYaml.prototype.constructor = ImportYaml;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ImportYaml.prototype.main = function (callback) {
        var config = this.getCurrentConfig(),
            srcHash = config.srcHash,
            base = config.baseType || 'FCO';

        if (!srcHash) {
            return callback('yaml not provided.', this.result);
        }

        this.blobClient.getMetadata(srcHash)
            .then(mdata => {  // Create the new model
                var name = mdata.name.replace(/.ya?ml$/, '');
                this.tgtNode = this.core.createNode({
                    base: this.META[base],
                    parent: this.rootNode
                });
                this.core.setAttribute(this.tgtNode, 'name', name);
                return this.blobClient.getObjectAsString(srcHash);
            })
            .then(src => {  // Retrieved the source code
                this.logger.debug('Retrieved the yaml');
                var converter = new GraphChecker(this.core),
                    nodes = converter.yaml(src).nodes(),
                    nodeMap = {};

                if (nodes.length === 0) {
                    throw Error('No nodes found. Is the file valid yaml?');
                }

                nodes.forEach(node => nodeMap[node.id] = this.createNode(node));

                // Create all the connections
                nodes.forEach(node => {
                    node.next.map(id => nodeMap[id])
                        .forEach(next => this.connect(nodeMap[node.id], next));
                });

                return this.save('ImportYaml updated model.');
            })
            .then(() => {  // changes saved successfully
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err =>
                callback(err, this.result)
            );

    };

    ImportYaml.prototype.createNode = function (desc) {
        var node,
            attrs = Object.keys(desc.attributes);

        node = this.core.createNode({
            base: this.META[desc.type],
            parent: this.tgtNode
        });

        // Add attributes
        attrs.forEach(attr => 
            this.core.setAttribute(node, attr, desc.attributes[attr])
        );

        return node;
    };

    ImportYaml.prototype.connect = function (src, dst) {
        var base = this.getCurrentConfig().connType || 'FCO',
            conn;

        conn = this.core.createNode({
            base: this.META[base],
            parent: this.tgtNode
        });

        this.core.setPointer(conn, 'src', src);
        this.core.setPointer(conn, 'dst', dst);
        return conn;
    };

    return ImportYaml;
});
