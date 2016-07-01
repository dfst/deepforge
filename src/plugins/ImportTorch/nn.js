/* globals define */
// This is the searcher for the mock library
define([
    'deepforge/layer-args',
    'common/util/assert',
    'deepforge/lua'
], function(
    createLayerDict,
    assert,
    luajs
) {
    'use strict';

    var createSearcher = function(plugin, context) {
        var core = plugin.core,
            META = plugin.META,
            logger = plugin.logger.fork('nn'),
            parent = plugin.tgtNode,
            LayerDict = createLayerDict(core, META),
            helpers = context.__helpers,
            oldSet = helpers.__set,
            isSetting = false;

        // Override the helper's '__set' method to detect
        // if the code is in the middle of a "set".
        helpers.__set = function() {
            isSetting = true;
            oldSet.apply(this, arguments);
            isSetting = false;
        };

        var connect = function(src, dst) {
            var conn = core.createNode({
                parent: parent,
                base: META.Connection
            });
            core.setPointer(conn, 'src', src);
            core.setPointer(conn, 'dst', dst);
        };

        // nn drawing library
        var Layer = function(base, attrs, args) {
            this._base = base;
            this._attrs = attrs;
            for (var i = 0; i < attrs.length; i++) {
                this[attrs[i].name] = args[i];
            }

            // inputs/outputs used for being added to containers
            this._cachedNode = null;
            this._inputs = [this._node()];
            this._outputs = [this._node()];
        };

        Layer.prototype._node = function() {
            var name,
                node,
                value;

            if (this._cachedNode) {
                // only generate a single node for each layer
                return this._cachedNode;
            }

            assert(META[this._base], this._base + ' is not a supported type');
            node = core.createNode({
                base: META[this._base],
                parent: parent
            });

            for (var i = this._attrs.length; i--;) {
                name = this._attrs[i].name;
                value = this[name]; 
                if ((typeof value) === 'object') {
                    // special lua.js object
                    value = value.valueOf();
                }

                // TODO: Update this to check if inferred and the value matches
                // our inferred value. If so, skip it
                if (value !== undefined/*&& !this._attrs[i].infer*/) {
                    core.setAttribute(node, name, value);
                }
            }

            this._cachedNode = node;
            return node;
        };

        // Each container will have `inputs` and `outputs`
        var Container = function() {
            // inputs and outputs are webgme nodes
            this._inputs = [];
            this._outputs = [];
        };

        Container.prototype.add = function() {
            logger.error('Add is not overridden!');
        };

        var Sequential = function(/*attrs, args*/) {
            Container.call(this);
        };

        Sequential.prototype = new Container();

        Sequential.prototype.add = function(self, tlayer) {
            var layer = tlayer.get('_node'),
                nodes = layer._inputs;

            // If this._inputs is empty, add the layer to the inputs list
            if (this._inputs.length === 0) {  // first node
                this._inputs = this._inputs.concat(nodes);
            } else {
                // connect all inputs of the added node to the current outputs
                this._outputs.forEach(src =>
                    nodes.forEach(dst => connect(src, dst))
                );
            }
            this._outputs = layer._outputs;
            return self;
        };

        var Concat = function(attrs, args) {
            Container.call(this);

            // Create a concat node and add it to this._outputs
            var concat = new Layer('Concat', attrs, args);
            this._outputs.push(concat._node());
        };

        Concat.prototype = new Container();

        Concat.prototype.add = function(self, tlayer) {
            // Connect the tlayer outputs to this._outputs
            var layer = tlayer.get('_node'),
                concatLayer = this._outputs[0];

            layer._outputs.forEach(output => connect(output, concatLayer));

            // Connect the incomingly connected node to tlayer
            // TODO: This might not work if adding layers after this container is
            // added to some parent

            // Add the layer's inputs to the inputs
            this._inputs = this._inputs.concat(layer._inputs);
            return self;
        };

        // Special layers (with special functions - like 'add')
        var LAYERS = {
            Concat: Concat,
            Sequential: Sequential
        };

        var CreateLayer = function(type) {
            var res = luajs.newContext()._G,
                attrs = [].slice.call(arguments, 1),
                ltGet = luajs.types.LuaTable.prototype.get,
                node;

            if (LAYERS[type]) {
                node = new LAYERS[type](LayerDict[type] || [], attrs);
            } else {  // Call generic Layer with type name
                node = new Layer(type, LayerDict[type] || [], attrs);
            }

            res.set('_node', node);

            // all public methods (and attributes) get added to lua context
            for (var fn in node) {
                if (fn.indexOf('_') !== 0) {
                    if (typeof node[fn] === 'function') {
                        res.set(fn, node[fn].bind(node));
                    } else {
                        res.set(fn, node[fn]);
                    }
                }
            }

            // Override get
            res.get = function noNilGet(value) {
                var result = ltGet.call(this, value);
                if (!result && !isSetting) {
                    throw Error(`"${value}" is not supported for ${type}`);
                }
                return result;
            };

            return res;
        };

        // searcher
        return function (pkg) {
            if (pkg !== 'nn') {
                return;
            }

            // TODO: Create the nn object
            var nn = luajs.newContext()._G,
                names = Object.keys(LayerDict);

            for (var i = names.length; i--;) {
                nn.set(names[i], CreateLayer.bind(null, names[i]));
            }

            // Additional containers the sequential layer
            var extraLayers = [
                'Sequential',
                'Concat'
            ];

            extraLayers.forEach(name => nn.set(name, CreateLayer.bind(null, name)));

            this._G.set('nn', nn);
            return nn;
        };
    };

    return createSearcher;
});
