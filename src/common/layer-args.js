/* globals define*/
define([
], function(
) {
    'use strict';

    var prepAttribute = function(core, node, attr) {
        var result = {name: attr},
            schema = core.getAttributeMeta(node, attr);

        for (var key in schema) {
            result[key] = schema[key];
        }

        return result;
    };

    var isArgument = function(arg) {
        return arg.hasOwnProperty('argindex');
    };

    var isSetter = function(arg) {
        return arg.hasOwnProperty('setterType');
    };

    var sortByIndex = function(a, b) {
        return a.argindex > b.argindex;
    };

    var createLayerDict = function(core, meta) {
        var node,
            names = Object.keys(meta),
            layers = {},
            setters,
            attrs;

        for (var i = names.length; i--;) {
            node = meta[names[i]];
            attrs = core.getValidAttributeNames(node)
                .map(attr => prepAttribute(core, node, attr));
            layers[names[i]] = {};
            layers[names[i]].args = attrs
                .filter(isArgument)
                .sort(sortByIndex);

            layers[names[i]].setters = {};
            setters = attrs.filter(isSetter);
            for (var j = setters.length; j--;) {
                layers[names[i]].setters[setters[j].name] = setters[j];
            }
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
