/*globals define*/
/*jshint node:true, browser:true*/

define([
    'SimpleNodes/SimpleNodes',
    'SimpleNodes/Constants',
    'deepforge/layer-args',
    'deepforge/utils',
    'underscore',
    'text!./metadata.json'
], function (
    PluginBase,
    Constants,
    createLayerDict,
    utils,
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

    GenerateArchitecture.prototype.getTemplateSettings = function () {
        return null;
    };

    GenerateArchitecture.prototype.main = function () {
        this.addCustomLayersToMeta();
        this.LayerDict = createLayerDict(this.core, this.META);
        this.uniqueId = 2;
        this.varnames = {};
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

    GenerateArchitecture.prototype.hoist = function (code) {
        this.definitions.push(code);
    };

    GenerateArchitecture.prototype.createOutputFiles = function (tree) {
        var layers = tree[Constants.CHILDREN],
            result = {},
            code = '';

        this.definitions = [
            'require \'nn\'',
            'require \'rnn\''
        ];

        // Add an index to each layer
        layers.forEach((l, index) => l[INDEX] = index);

        // Define custom layers
        if (this.getCurrentConfig().standalone) {
            this.logger.debug('Generating layer definitions');
            code += this.genLayerDefinitions(layers);
        }

        this.logger.debug('Generating architecture code...');
        code += this.genArchCode(layers);
        this.logger.debug('Prepending hoisted code...');
        code = this.definitions.join('\n') + '\n' + code;

        result[tree.name + '.lua'] = code;
        this.logger.debug(`Finished generating ${tree.name}.lua`);
        return result;
    };

    GenerateArchitecture.prototype.genArchCode = function (layers) {
        return [
            this.createSequential(layers[0], 'net').code,
            '\nreturn net'
        ].join('\n');
    };

    GenerateArchitecture.prototype.genRawArchCode = function (layers, name) {
        var result = '';
        if (layers.length > 1) {
            return this.createSequential(layers[0], name).code;
        } else if (name) {
            result = `\nlocal ${name} = `;
        }
        result += this.createLayer(layers[0]);
        return result;
    };

    GenerateArchitecture.prototype.getVarName = function (base) {
        // Check "this.varnames"
        var name = base,
            i = 2;

        while (this.varnames[name]) {
            name = base + '_' + (i++);
        }
        this.varnames[name] = true;

        return name;
    };

    GenerateArchitecture.prototype.createLayer = function (layer) {
        var args = this.createArgString(layer);
        return `nn.${layer.name}${args}`;
    };

    GenerateArchitecture.prototype.createSequential = function (layer, name) {
        var next = layer[Constants.NEXT][0],
            args,
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
                snippet = this.createLayer(layer);
                code += `\n${name}:add(${snippet})`;

            }

            while (layer && layer[Constants.NEXT].length > 1) {  // concat/parallel
                // if there is a fork, recurse and add a concat layer

                this.logger.debug(`detected fork of size ${layer[Constants.NEXT].length}`);
                snippets = layer[Constants.NEXT].map(nlayer =>
                    this.createSequential(nlayer, this.getVarName('net')));
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
                        result = this.createSequential(next, this.getVarName('net'));
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

    GenerateArchitecture.prototype.getValue = function (arg, layer) {
        var content = layer[arg];

        if (typeof content === 'object') {  // layer as arg
            if (content[Constants.CHILDREN].length) {
                // Generate the code for the children of layer[arg]
                var name = this.getVarName(utils.abbr(arg)),
                    layers;

                this.logger.debug(`Adding layer arg for ${arg} (${layer.name})`);
                try {
                    layers = this.genRawArchCode(layer[arg][Constants.CHILDREN], name);
                } catch (e) {
                    this.logger.error(`Layer arg creation failed: ${e}`);
                    return null;
                }

                // hoist layer definitions to the top of the file
                this.hoist(layers);
                return name;
            } else {
                return null;
            }
        }
        return content;
    };

    GenerateArchitecture.prototype.createArgString = function (layer) {
        var setters = this.LayerDict[layer.name].setters,
            setterNames = Object.keys(this.LayerDict[layer.name].setters),
            base = layer[Constants.BASE],
            desc,
            fn,
            layerCode;

        this.logger.debug(`Creating arg string for ${layer.name}`);
        layerCode = '(' + this.LayerDict[layer.name].args
            .map(arg => this.getValue(arg.name, layer))
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
            } else if (layer[setterNames[i]] !== null && layer[setterNames[i]] !== undefined) {
                fn = desc.setterFn;
                layerCode += `:${fn}(${layer[setterNames[i]]})`;
            }
        }

        this.logger.debug(`Created nn.${layer.name}${layerCode}`);
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
