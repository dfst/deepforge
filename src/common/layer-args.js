/* globals define*/
define([
], function(
) {
    'use strict';

    var prepAttribute = function(core, node, attr) {
        var result = {name: attr},
            schema = core.getAttributeMeta(node, attr),
            keys = Object.keys(schema);

        keys.forEach(key => result[key] = schema[key]);

        return result;
    };

    var isArgument = function(arg) {
        return arg.hasOwnProperty('argindex');
    };

    var sortByIndex = function(a, b) {
        return a.argindex > b.argindex;
    };

    var createLayerDict = function(core, meta) {
        var node,
            names = Object.keys(meta),
            layers = {};

        for (var i = names.length; i--;) {
            node = meta[names[i]];
            layers[names[i]] = core.getValidAttributeNames(node)
                .map(attr => prepAttribute(core, node, attr))
                .filter(isArgument)
                .sort(sortByIndex);
        }

        return layers;
    };

    // When provided with the META, create the given LayerDict object
    //  - Sort (and filter) by argindex
    //  - add name attribute to schema
    //  - store this array under the META name

    // LayerDict contains:
    //  name: [{schema (including name)}, {schema+name}]
    return createLayerDict;
});
