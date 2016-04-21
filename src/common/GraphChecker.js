define([
    'deepforge/js-yaml.min'
], function(
    yaml
) {

    var Importer = function(opts) {
        opts = opts || {};
        this._core = opts.core || opts;

        // Add attributes to ignore
        this._ignore = opts.ignore || {};
    };

    var rmFields = function(nodes, ignored) {
        var fields = Object.keys(ignored),
            entries,
            n;

        for (var i = fields.length; i--;) {
            entries = ignored[fields[i]];
            if (entries instanceof Array) {
                for (var j = entries.length; j--;) {
                    for (n = nodes.length; n--;) {
                        if (nodes[n][fields[i]]) {
                            delete nodes[n][fields[i]][entries[j]];
                        }
                    }
                }
            } else {  // remove entire field
                for (n = nodes.length; n--;) {
                    delete nodes[n][fields[i]];
                }
            }
        }
    };

    Importer.prototype.gme = function(children) {
        var conns = children.filter(child => isConnection(this._core, child)),
            gmeToId = {},
            gmeToNode = {},
            nodes;

        nodes = children
            .filter(child => !isConnection(this._core, child))
            .map(node => {
                var n = fromGme(this._core, node),
                    id = this._core.getPath(node);
                gmeToId[id] = n.id;
                gmeToNode[id] = n;
                return n;
            });

        // Set the 'next' values
        conns.forEach(conn => {
            var dstId = this._core.getPointerPath(conn, 'dst'),
                srcId = this._core.getPointerPath(conn, 'src'),
                src = gmeToNode[srcId];

            src.next.push(gmeToId[dstId]);
        });

        // Removed ignored fields
        rmFields(nodes, this._ignore);

        return new Nodes({core: this._core, ignore: this._ignore}, nodes);
    };

    Importer.prototype.yaml = function(text) {
        var nodes = yaml.load(text);

        rmFields(nodes, this._ignore);

        return new Nodes({core: this._core, ignore: this._ignore}, nodes);
    };

    var Exporter = function(nodes) {
        this._nodes = nodes;
    };

    Exporter.prototype.yaml = function() {
        return yaml.dump(this._nodes);
    };

    var Operator = function(opts, nodes, fn) {
        Importer.call(this, opts);
        this._nodes = nodes;
        this._fn = fn;
        this.to = this;
    };

    // For each of the converter formats, create an operator function
    // that converts then calls the _fn
    Object.keys(Importer.prototype)  // formats
        .forEach(format => Operator.prototype[format] = function() {
            var nodes = Importer.prototype[format].apply(this, arguments).nodes();
            return this._fn(this._nodes, nodes);
        });

    var Nodes = function(opts, nodes) {
        this._nodes = nodes;

        nodes.forEach(node => {
            node.next = node.next || [];
            node.attributes = node.attributes || {};
        });

        // Operations
        this.map = new Operator(opts, nodes, _modelMatches);
        this.to = new Exporter(nodes);
    };

    Nodes.prototype.nodes = function() {
        return this._nodes;
    };

    var fromGme = function(core, node) {
        var result = {},
            attrs,
            n;

        n = core.getBase(node);

        result.type = core.getAttribute(n, 'name');
        result.id = core.getPath(node);
        result.next = [];

        // Get attribute names
        attrs = core.getAttributeNames(node).filter(name => name !== 'name');

        result.attributes = {};
        for (var i = attrs.length; i--;) {
            result.attributes[attrs[i]] = core.getAttribute(node, attrs[i]);
        }

        return result;
    };

    var isConnection = function(core, node) {
        var ptrs = core.getPointerNames(node);
        return ptrs.indexOf('src') !== -1 && ptrs.indexOf('dst') !== -1;
    };

    var GraphChecker = function(opts) {
        opts = opts || {};
        Importer.call(this, opts);
    };

    GraphChecker.prototype = new Importer();

    // Check if two models are isomorphic
    var modelMatches = function(gmeNodes, text) {
        var nodes = convertNodes(gmeNodes),
            soln = yaml.load(text);

        nodes.concat(soln).forEach(node => {
            node.next = node.next || [];
            node.attributes = node.attributes || {};
        });

        return _modelMatches(nodes, soln);
    };

    //////////////// Operators ////////////////
    var _modelMatches = function(soln, nodes) {
        var nodeMap = createMap(nodes),
            solnMap = createMap(soln),
            sInits,  // soln start nodes
            nInits,  // 'nodes' start nodes
            resMap = {},  // soln node id to node id
            solnIds = soln.map(n => n.id),
            nodeIds = nodes.map(n => n.id);

        if (nodes.length !== soln.length) {
            return false;
        }

        // get the node with the fewest number of options
        var startTuple = getMostConstrained(soln, nodes),
            startId = startTuple[0].id;

        if (startTuple[1].length === 0) {
            return false;
        }

        return inferGraph(startId, solnMap, nodeMap);
    };

    var getMostConstrained = function(soln, nodes) {
        var options = soln.map(sn => [sn, nodes.filter(n => nodesMatch(sn, n))]),
            startId;

        options.sort((a, b) => b[1].length < a[1].length);
        return options[0];
    };

    var inferGraph = function(id, solnMap, nodeMap, mappings) {
        var snext = solnMap[id].next,
            nodes = Object.keys(nodeMap).map(id => nodeMap[id]),
            snode = solnMap[id],
            options,
            used,
            node;

        mappings = mappings || {};

        if (mappings.hasOwnProperty(id)) {  // skip if already been assigned
            return mappings;
        }

        used = Object.keys(mappings).map(id => mappings[id]);
        options = nodes
            .filter(n => used.indexOf(n.id) === -1)  // Remove already taken ids
            .filter(n => nodesMatch(n, snode));

        if (options.length === 0) {
            return null;
        }

        // try all the options
        var result,
            mappings2;

        snext = snext
            .filter(id => !mappings.hasOwnProperty(id));

        // Filter by known connections into
        // TODO

        if (snext.length === 0 && nodes.length !== (used.length + 1)) {
            // Add the next most constrained node to snext
            var startId,
                tuple,
                soln;

            soln = Object.keys(solnMap)
                .filter(nId => nId != id && !mappings.hasOwnProperty(nId))  // not assigned
                .map(id => solnMap[id]);

            tuple = getMostConstrained(soln, nodes);
            startId = tuple[0].id;

            if (tuple[1].length === 0) {
                return null;
            }

            snext.push(startId);
        }

        for (var i = options.length; i--;) {
            mappings[id] = options[i].id;  // need to clone the object

            mappings2 = clone(mappings);
            result = snext.reduce((prev, curr) => {
                mappings2 = inferGraph(curr, solnMap, nodeMap, mappings2);
                return prev && mappings;
            }, true);

            if (result) {
                return mappings2;
            }
        }

        return null;

        // infer parent nodes of id
        // TODO
    };

    var clone = function(obj) {
        var keys = Object.keys(obj),
            res = {};

        for (var i = keys.length; i--;) {
            res[keys[i]] = obj[keys[i]];
        }

        return res;
    };

    var nodesMatch = function(n1, n2) {
        var a1 = Object.keys(n1.attributes),
            a2 = Object.keys(n2.attributes);

        return n1.type === n2.type &&  // compare META id
                n1.next.length === n2.next.length &&  // # of conns
            // compare attributes:
            // if they have a different number of attrs, don't bother
            // ow - check that the attributes match
                a1.length === a2.length &&
                a1.reduce((prev, attr) => {
                    return prev &&
                        n2.attributes[attr] === n1.attributes[attr];
                }, true);
    };

    var createMap = function(nodes) {
        var result = {};

        for (var i = nodes.length; i--;) {
            result[nodes[i].id] = nodes[i];
        }

        return result;
    };

    // Convert nodes to the form:
    //   - type: MetaType
    //     id:
    //     attributes:
    //       - attr: 2
    //     next:
    //       - id1

    return GraphChecker;
});
