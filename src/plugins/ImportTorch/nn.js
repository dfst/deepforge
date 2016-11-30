/* globals define */
// This is the searcher for the mock library
define([
    'deepforge/layer-args',
    'common/util/assert',
    'deepforge/Constants',
    'deepforge/lua'
], function(
    createLayerDict,
    assert,
    Constants,
    lua
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
            isSetting = false,
            connsFrom = {};

        // Override the helper's '__set' method to detect
        // if the code is in the middle of a "set".
        helpers.__set = function() {
            isSetting = true;
            oldSet.apply(this, arguments);
            isSetting = false;
        };

        var stringify = function(table) {
            var strings = table.array.map(val => {
                if (val instanceof lua.types.LuaTable) {
                    return stringify(val);
                } else {
                    return val;
                }
            });
            return '{' + strings.join(', ') + '}';
        };

        var getAttributeString = function(value, layerType) {
            if (value instanceof lua.types.LuaTable) {
                if (value.get('_node')) {
                    throw Error(`Detected unsupported varargs (composed of layers) for ${layerType}`);
                }
                return stringify(value);
            } else if ((typeof value) === 'object') {
                // special lua.js object
                value = value.valueOf();
            }

            return value;
        };

        var allConnectedTo = function(current) {
            var connectedIds = {},
                node,
                id;

            while (current.length) {
                node = current.shift();
                id = core.getGuid(node);
                if (connectedIds[id]) {
                    continue;
                }

                connectedIds[id] = node;
                if (connsFrom[id]) {
                    current = current.concat(connsFrom[id]);
                }
            }
            // Return an array of all things connected to the
            // given node
            return Object.keys(connectedIds).map(key => connectedIds[key]);
        };

        var connect = function(src, dst) {
            var conn,
                id;

            conn = core.createNode({
                parent: parent,
                base: META.Connection
            });
            core.setPointer(conn, 'src', src);
            core.setPointer(conn, 'dst', dst);
            // Record this
            id = core.getGuid(src);
            if (!connsFrom[id]) {
                connsFrom[id] = [];
            }
            connsFrom[id].push(conn, dst);
            return conn;
        };

        // nn drawing library
        var Layer = function(base, attrs, args) {
            this._base = base;
            this._attrs = attrs;

            for (var i = 0; i < attrs.length; i++) {
                this[attrs[i].name] = args[i];
            }

            // inputs/outputs used for being added to containers
            this._values = args;
            this._cachedNode = null;
            this._inputs = [this._node()];
            this._outputs = [this._node()];
        };

        Layer.prototype._node = function() {
            var name,
                node,
                nodes,
                cntr,
                layer,
                cntrName,
                value,
                i;

            if (this._cachedNode) {
                // only generate a single node for each layer
                return this._cachedNode;
            }

            assert(META[this._base], this._base + ' is not a supported type');
            node = core.createNode({
                base: META[this._base],
                parent: parent
            });

            // merge all the last arguments into a single one (ie, assume the last
            // attribute is varargs
            if (this._attrs.length < this._values.length) {
                i = this._attrs.length;
                value = this._values.splice(i-1)
                    .map(val => getAttributeString(val, this._base)).join(', ');
                this._values.push(value);
            }

            // Add the attributes to the layer
            for (i = this._attrs.length; i--;) {
                name = this._attrs[i].name;
                value = this._values[i];

                if (value instanceof lua.types.LuaTable) {
                    layer = value.get('_node');
                    if (layer) {  // layer arg!
                        // add all the inputs, outputs (and connected elements) to
                        // be in an "Architecture" node in the current node
                        cntr = core.createNode({
                            base: META.Architecture,
                            parent: node
                        });
                        cntrName = `${name} (${this._base})`;
                        logger.debug(`Naming layer arg ${cntrName}`);
                        core.setAttribute(cntr, 'name', cntrName);
                        // Move all connecting elements of the value to 
                        // the cntr
                        nodes = allConnectedTo(layer._inputs.concat(layer._outputs));
                        for (var j = nodes.length; j--;) {
                            core.moveNode(nodes[j], cntr);
                        }
                        core.setPointer(node, name, cntr);
                        logger.debug(`Moving ${nodes.length} to ${name}(${this._base})`);
                    } else {  // Something like {1, 2, 3}
                        value = stringify(value);
                        logger.debug(`Setting ${name} to ${value} (${this._base})`);
                        core.setAttribute(node, name, value);
                    }
                } else {  // attribute value
                    if ((typeof value) === 'object') {
                        // special lua.js object
                        value = value.valueOf();
                    }
                    if (value !== undefined) {
                        logger.debug(`Setting ${name} to ${value} (${this._base})`);
                        core.setAttribute(node, name, value);
                    }
                }
            }

            this._cachedNode = node;
            return node;
        };

        Layer.prototype._setAttribute = function(name, self, value) {
            var node = this._node();
            logger.info(`Setting ${name} to ${value}`);
            core.setAttribute(node, name, value);
            return self;
        };

        Layer.prototype._getAllNodes = function() {
            return [this._node()];
        };

        var Container = function() {
            Layer.apply(this, arguments);
            this._nestedIndex = 0;
        };

        Container.prototype = Object.create(Layer.prototype);

        Container.prototype.add = function(self, tlayer) {
            var layer = tlayer.get('_node'),
                container = this._node(),
                children,
                arch;

            // Add a nested 'Architecture' node
            arch = core.createNode({
                parent: container,
                base: META.Architecture
            });

            // Add this node to the 'addLayers' set
            core.addMember(container, Constants.CONTAINED_LAYER_SET, arch);
            // Assign it an appropriate 'index' value
            core.setMemberRegistry(
                container,
                Constants.CONTAINED_LAYER_SET,
                core.getPath(arch),
                Constants.CONTAINED_LAYER_INDEX,
                this._nestedIndex++
            );

            // Move the added node(s)/conns to this architecture node
            children = layer._getAllNodes();
            for (var i = children.length; i--;) {
                core.moveNode(children[i], arch);
            }
            layer._parent = arch;
            return self;
        };

        // Implicit Containers are sequential and concat containers;
        // these containers are visually implied in deepforge (although
        // they are explicitly defined in torch)
        var ImplicitContainer = function() {
            // inputs and outputs are webgme nodes
            this._inputs = [];
            this._outputs = [];
            this._children = [];
            this._connections = [];
        };

        // Implicit containers will have to record their 'children'.
        // When an implicit container is added to an actual container,
        // the container will set it's '_parent' value. If any additional
        // layers are added to the implicit container after, they will
        // need to be moved to the parent of the implicit container
        ImplicitContainer.prototype.add = function() {
            logger.error('Add is not overridden!');
        };

        ImplicitContainer.prototype._getAllNodes = function() {
            var nodes = this._children.map(layer => layer._getAllNodes())
                .reduce((l1, l2) => l1.concat(l2), []);

            return this._connections.concat(nodes);
        };

        var Sequential = function(/*attrs, args*/) {
            ImplicitContainer.call(this);
        };

        Sequential.prototype = new ImplicitContainer();

        Sequential.prototype.add = function(self, tlayer) {
            var layer = tlayer.get('_node'),
                nodes = layer._inputs,
                connections = [];

            // If this._inputs is empty, add the layer to the inputs list
            if (this._inputs.length === 0) {  // first node
                this._inputs = this._inputs.concat(nodes);
            } else {
                // connect all inputs of the added node to the current outputs
                // add the connection to the list of allNodes
                this._outputs.forEach(src =>
                    nodes.forEach(dst => connections.push(connect(src, dst)))
                );
            }
            this._outputs = layer._outputs;
            this._children.push(layer);
            this._connections = this._connections.concat(connections);

            // If _parent is set, move the nodes and connection to the _parent node
            if (this._parent) {
                nodes = layer._getAllNodes().concat(connections);
                for (var i = nodes.length; i--;) {
                    core.moveNode(nodes[i], this._parent);
                }
            }
            return self;
        };

        var Concat = function(attrs, args) {
            ImplicitContainer.call(this);

            // Create a concat node and add it to this._outputs
            var concat = new Layer('Concat', attrs, args);
            this._outputs.push(concat._node());
            this._children.push(concat);
        };

        Concat.prototype = new ImplicitContainer();

        Concat.prototype.add = function(self, tlayer) {
            // Connect the tlayer outputs to this._outputs
            var layer = tlayer.get('_node'),
                concatLayer = this._outputs[0],
                connections = [],
                nodes;

            layer._outputs.forEach(output =>
                connections.push(connect(output, concatLayer)));

            // Connect the incomingly connected node to tlayer
            // TODO: This might not work if adding layers after this container is
            // added to some parent

            // Add the layer's inputs to the inputs
            this._inputs = this._inputs.concat(layer._inputs);
            this._children.push(layer);
            this._connections = this._connections.concat(connections);
            if (this._parent) {
                nodes = layer._getAllNodes().concat(connections);
                for (var i = nodes.length; i--;) {
                    core.moveNode(nodes[i], this._parent);
                }
            }
            return self;
        };

        // Special layers (with special functions - like 'add')
        var CONTAINERS,
            LAYERS = {
                Concat: Concat,
                Sequential: Sequential
            };

        var getValue = function(txt) {
            if (txt === 'true') {
                return true;
            }

            if (txt === 'false') {
                return false;
            }

            if (/^\d+$/.test(txt)) {
                return +txt;
            }

            return txt;
        };

        var addSetterMethods = function(table, attr, dict) {
            var desc = dict[attr],
                layer = table.get('_node'),
                vals,
                value,
                fn;

            if (desc.setterType === 'arg') {
                fn = desc.setterFn;
                table.set(fn, layer._setAttribute.bind(layer, attr));
            } else {
                vals = Object.keys(desc.setterFn);
                for (var i = vals.length; i--;) {
                    fn = desc.setterFn[vals[i]];
                    value = getValue(vals[i]);
                    table.set(fn, layer._setAttribute.bind(layer, attr, table, value));
                }
            }
        };

        var CreateLayer = function(type) {
            var res = lua.newContext()._G,
                attrs = [].slice.call(arguments, 1),
                ltGet = lua.types.LuaTable.prototype.get,
                setters = [],
                args = [],
                node;

            if (LayerDict[type]) {
                args = LayerDict[type].args;
                setters = Object.keys(LayerDict[type].setters);
            }

            if (LAYERS[type]) {
                node = new LAYERS[type](args, attrs);
            } else if (CONTAINERS[type]) {
                node = new Container(type, args, attrs);
                res.set('add', node.add.bind(node)); // add the 'add' method
            } else {  // Call generic Layer with type name
                node = new Layer(type, args, attrs);
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

            // add setters
            // look up the setters
            for (var i = setters.length; i--;) {
                addSetterMethods(res, setters[i], LayerDict[type].setters);
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

            // Mocking the nn layers (as defined in the metamodel)
            var nn = lua.newContext()._G,
                names = Object.keys(LayerDict),
                base,
                baseName;

            // For each layer, check the name of the base type. If it is 'Container',
            // then it should be added to the CONTAINERS dictionary. This will change how
            // it is handled in 'CreateLayer'
            CONTAINERS = {};

            for (var i = names.length; i--;) {
                base = core.getBase(META[names[i]]);
                baseName = core.getAttribute(base, 'name');
                if (baseName === 'Container') {
                    CONTAINERS[names[i]] = true;
                }
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
