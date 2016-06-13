/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Sun Mar 20 2016 16:49:12 GMT-0500 (CDT).
 */

define([
    'SimpleNodes/SimpleNodes',
    'SimpleNodes/Constants',
    'deepforge/layer-args',
    './dimensionality',
    'underscore',
    'text!./metadata.json'
], function (
    PluginBase,
    Constants,
    createLayerDict,
    dimensionality,
    _,
    metadata
) {
    'use strict';

    /**
     * Initializes a new instance of GenerateArchitecture.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateArchitecture.
     * @constructor
     */
    var INDEX = '__index__';
    var GenerateArchitecture = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = GenerateArchitecture.metadata;
    };

    GenerateArchitecture.metadata = JSON.parse(metadata);

    // Prototypal inheritance from PluginBase.
    GenerateArchitecture.prototype = Object.create(PluginBase.prototype);
    GenerateArchitecture.prototype.constructor = GenerateArchitecture;

    GenerateArchitecture.prototype.main = function () {
        this.LayerDict = createLayerDict(this.core, this.META);
        this.uniqueId = 2;
        this._oldTemplateSettings = _.templateSettings;
        return PluginBase.prototype.main.apply(this, arguments);
    };

    GenerateArchitecture.prototype.createOutputFiles = function (tree) {
        var layers = tree[Constants.CHILDREN],
            //initialLayers,
            result = {},
            code;

        //initialLayers = layers.filter(layer => layer[Constants.PREV].length === 0);
        // Add an index to each layer
        layers.forEach((l, index) => l[INDEX] = index);
        code = this.genArchCode(layers);

        result[tree.name + '.lua'] = code;
        _.templateSettings = this._oldTemplateSettings;  // FIXME: Fix this in SimpleNodes
        return result;
    };

    GenerateArchitecture.prototype.genArchCode = function (layers) {
        // Create a 'null' start layer

        return [
            'require \'nn\'',
            this.createSequential(layers[0], 'net').code,
            '\nreturn net'
        ].join('\n');
    };

    GenerateArchitecture.prototype.createSequential = function (layer, name) {
        var next = layer[Constants.NEXT][0],
            args,
            template,
            snippet,
            snippets,
            code = `\nlocal ${name} = nn.Sequential()`,

            group,
            i,
            result;

        while (layer) {
            // if there is only one successor, just add the given layer
            if (layer[Constants.PREV].length > 1) {  // sequential layers are over
                next = layer;  // the given layer will be added by the caller
                break;
            } else {  // add the given layer
                args = this.createArgString(layer);
                template = _.template(name + ':add(nn.{{= name }}' + args + ')');
                snippet = template(layer);
                code += '\n' + snippet;

            }

            while (layer && layer[Constants.NEXT].length > 1) {  // concat/parallel
                // if there is a fork, recurse and add a concat layer

                this.logger.debug(`detected fork of size ${layer[Constants.NEXT].length}`);
                snippets = layer[Constants.NEXT].map(nlayer =>
                    this.createSequential(nlayer, 'net_'+(this.uniqueId++)));
                code += '\n' + snippets.map(snippet => snippet.code).join('\n');

                // Make sure all snippets end at the same concat node

                // Until all snippets end at the same concat node
                snippets.sort((a, b) => a.endIndex < b.endIndex ? -1 : 1);
                group = [];
                while (snippets.length > 0) {
                    // Add snippets to the group
                    i = 0;
                    while (i < snippets.length &&
                        snippets[0].endIndex === snippets[i].endIndex) {

                        group.push(snippets[i]);
                        i++;
                    }

                    // Add concat layer
                    layer = group[0].next;
                    if (layer) {
                        args = this.createArgString(layer);
                        code += `\n\nlocal concat_${layer[INDEX]} = nn.Concat${args}\n` +
                            group.map(snippet =>
                                `concat_${layer[INDEX]}:add(${snippet.name})`)
                            .join('\n') + `\n\n${name}:add(concat_${layer[INDEX]})`;
                        
                        next = layer[Constants.NEXT][0];
                    } else {
                        next = null;  // no next layers
                    }

                    // Remove the updated snippets
                    this.logger.debug('removing ' + i + ' snippet(s)');
                    snippets.splice(0, i);

                    // merge the elements in the group
                    if (snippets.length) {  // prepare next iteration
                        result = this.createSequential(next, 'net_'+(this.uniqueId++));
                        code += result.code;
                        group = [result];
                        this.logger.debug('updating group ('+ snippets.length+ ' left)');
                    }
                }
            }

            layer = next;
            next = layer && layer[Constants.NEXT][0];
        }

        return {
            code: code,
            name: name,
            endIndex: next ? next[INDEX] : Infinity,
            next: next
        };
    };

    GenerateArchitecture.prototype.createArgString = function (layer) {
        return '(' + this.LayerDict[layer.name].map(arg => {
            var value = layer[arg.name];
            // Infer if value is unset and infer.dimensionality is set
            if (!value && arg.infer === 'dimensionality') {
                value = dimensionality(layer[Constants.PREV][0]);
            }
            return value;
        }).join(', ') + ')';
    };

    return GenerateArchitecture;
});
