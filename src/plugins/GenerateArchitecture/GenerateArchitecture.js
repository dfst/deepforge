/*globals define*/
/*jshint node:true, browser:true*/

define([
    'SimpleNodes/SimpleNodes',
    'SimpleNodes/Constants',
    'deepforge/layer-args',
    'deepforge/utils',
    'deepforge/Constants',
    'underscore',
    'text!./metadata.json'
], function (
    PluginBase,
    SimpleNodeConstants,
    createLayerDict,
    utils,
    Constants,
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
        this.varnames = {net: true};
        this.definitions = [
            'require \'nn\'',
            'require \'rnn\''
        ];

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
        var layers = tree[SimpleNodeConstants.CHILDREN],
            result = {},
            code = '';

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
        var args = this.createArgString(layer),
            def = `nn.${layer.name}${args}`,
            type = layer.base.base.name,
            memberIds,
            node,
            name,
            children,
            id;

        // Check if it is a container and has the 'addLayers' set
        // If so, it should sort them by their registry 'index' and add
        // each nested architecture's code to the given container
        if (type === 'Container') {
            // Get the members of the 'addLayers' set
            memberIds = {};
            id = layer[SimpleNodeConstants.NODE_PATH];
            node = this._nodeCache[id];
            this.core.getMemberPaths(node, Constants.CONTAINED_LAYER_SET)
                .forEach(id => memberIds[id] = true);

            // Get the (sorted) children
            children = layer[SimpleNodeConstants.CHILDREN]
                .map(child => {  // get (child, index) tuples
                    var index = null;

                    id = child[SimpleNodeConstants.NODE_PATH];
                    if (memberIds[id]) {
                        index = this.core.getMemberRegistry(node,
                            Constants.CONTAINED_LAYER_SET, id, Constants.CONTAINED_LAYER_INDEX);
                    }
                    return [child, index];
                })
                .filter(pair => pair[1] !== null)  // remove non-members
                .sort((a, b) => a[1] < b[1] ? -1 : 1)  // sort by 'index'
                .map(pair => pair[0]);


            var addedLayerDefs = '',
                firstLayer;

            for (var i = 0; i < children.length; i++) {
                id = children[i][SimpleNodeConstants.NODE_PATH];
                // Get the children!
                firstLayer = children[i][SimpleNodeConstants.CHILDREN][0];
                name = this.getVarName(utils.abbr(layer.name + '_' + i));
                addedLayerDefs += this.createSequential(firstLayer, name).code;
                def += `:add(${name})`;
            }
            this.hoist(addedLayerDefs);
        }
        return def;
    };

    GenerateArchitecture.prototype.createSequential = function (layer, name) {
        var next = layer[SimpleNodeConstants.NEXT][0],
            args,
            snippet,
            snippets,
            code = `\nlocal ${name} = nn.Sequential()`,

            group,
            i,
            result;

        while (layer) {
            // if there is only one successor, just add the given layer
            if (layer[SimpleNodeConstants.PREV].length > 1) {  // sequential layers are over
                next = layer;  // the given layer will be added by the caller
                break;
            } else {  // add the given layer
                snippet = this.createLayer(layer);
                code += `\n${name}:add(${snippet})`;

            }

            while (layer && layer[SimpleNodeConstants.NEXT].length > 1) {  // concat/parallel
                // if there is a fork, recurse and add a concat layer

                this.logger.debug(`detected fork of size ${layer[SimpleNodeConstants.NEXT].length}`);
                snippets = layer[SimpleNodeConstants.NEXT].map(nlayer =>
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
                        
                        next = layer[SimpleNodeConstants.NEXT][0];
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
            next = layer && layer[SimpleNodeConstants.NEXT][0];
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
            if (content[SimpleNodeConstants.CHILDREN].length) {
                // Generate the code for the children of layer[arg]
                var name = this.getVarName(utils.abbr(arg)),
                    layers;

                this.logger.debug(`Adding layer arg for ${arg} (${layer.name})`);
                try {
                    layers = this.genRawArchCode(layer[arg][SimpleNodeConstants.CHILDREN], name);
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
            base = layer[SimpleNodeConstants.BASE],
            desc,
            fn,
            layerCode,
            args,
            i;

        this.logger.debug(`Creating arg string for ${layer.name}`);
        args = this.LayerDict[layer.name].args
            .map(arg => this.getValue(arg.name, layer));

        for (i = args.length; i--;) {
            if (GenerateArchitecture.isSet(args[i])) {
                break;
            }
            args.pop();
        }

        layerCode = '(' + args.map(arg => GenerateArchitecture.isSet(arg) ? arg : 'nil')
            .join(', ') + ')';

        // Add any setters
        // For each setter, check if it has been changed (and needs to be set)
        for (i = setterNames.length; i--;) {
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
