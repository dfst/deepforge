/*globals define*/
/*jshint node:true, browser:true*/

define([
    'SimpleNodes/SimpleNodes',
    'SimpleNodes/Constants',
    'deepforge/layer-args',
    'underscore',
    'text!./metadata.json'
], function (
    PluginBase,
    Constants,
    createLayerDict,
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
        this.addCustomLayersToMeta();
        this.LayerDict = createLayerDict(this.core, this.META);
        this.uniqueId = 2;
        this._oldTemplateSettings = _.templateSettings;
        return PluginBase.prototype.main.apply(this, arguments);
    };

    GenerateArchitecture.prototype.addCustomLayersToMeta = function () {
        var metaDict = this.core.getAllMetaNodes(this.rootNode);
        
        Object.keys(metaDict).map(id => metaDict[id])
            // Get all custom layers
            .filter(node => this.core.isTypeOf(node, this.META.Layer))
            // Add them to the meta
            .forEach(node => this.META[this.core.getAttribute(node, 'name')] = node);
    };

    GenerateArchitecture.prototype.createOutputFiles = function (tree) {
        var layers = tree[Constants.CHILDREN],
            //initialLayers,
            result = {},
            code = 'require \'nn\'\n';

        //initialLayers = layers.filter(layer => layer[Constants.PREV].length === 0);
        // Add an index to each layer
        layers.forEach((l, index) => l[INDEX] = index);

        // Define custom layers
        if (this.getCurrentConfig().standalone) {
            code += this.genLayerDefinitions(layers);
        }

        code += this.genArchCode(layers);

        result[tree.name + '.lua'] = code;
        _.templateSettings = this._oldTemplateSettings;  // FIXME: Fix this in SimpleNodes
        return result;
    };

    GenerateArchitecture.prototype.genArchCode = function (layers) {
        return [
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
        var setters = this.LayerDict[layer.name].setters,
            setterNames = Object.keys(this.LayerDict[layer.name].setters),
            base = layer[Constants.BASE],
            desc,
            fn,
            layerCode;

        layerCode = '(' + this.LayerDict[layer.name].args
            .map(arg => layer[arg.name])
            .filter(GenerateArchitecture.isSet)
            .join(', ') + ')';

        // Add any setters
        // For each setter, check if it has been changed (and needs to be set)
        for (var i = setterNames.length; i--;) {
            desc = setters[setterNames[i]];
            if (desc.setterType === 'const') {
                // if the value is not the default, add the given fn
                if (layer[setterNames[i]] !== base[setterNames[i]]) {
                    fn = desc.setterFn[layer[setterNames[i]]];
                    layerCode += `:${fn}()`;
                }
            } else if (layer[setterNames[i]] !== null) {
                fn = desc.setterFn;
                layerCode += `:${fn}(${layer[setterNames[i]]})`;
            }
        }

        return layerCode;
    };

    GenerateArchitecture.isSet = function (value) {
        return !(value === undefined || value === null || value === '');
    };

    GenerateArchitecture.prototype.genLayerDefinitions = function(layers) {
        var code = '',
            customLayerId = this.core.getPath(this.META.CustomLayer),
            customLayers = layers.filter(layer => {  // Get the custom layers
                var node = this.META[layer.name];
                return this.core.getMixinPaths(node).indexOf(customLayerId) !== -1;
            });

        if (customLayers.length) {
            code += '\n-------------- Custom Layer Definitions --------------\n\n';
            code += customLayers.map(layer => layer.code).join('\n');
            code += '\n\n-------------- Network --------------\n';
        }

        return code;
    };
    return GenerateArchitecture;
});
