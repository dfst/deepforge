/* globals define*/
define([
    'deepforge/Constants'
], function(
    Constants
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

    var isSetter = function(arg) {
        return arg.hasOwnProperty('setterType');
    };

    var createLayerDict = function(core, meta) {
        var node,
            names = Object.keys(meta),
            layers = {},
            setters,
            ctorData,
            ctorArgs,
            attrs;

        for (var i = names.length; i--;) {
            node = meta[names[i]];
            ctorData = core.getAttribute(node, Constants.CTOR_ARGS_ATTR);
            attrs = core.getValidAttributeNames(node);

            layers[names[i]] = {};
            if (ctorData) {
                ctorArgs = ctorData.split(',')
                    .map(attr => prepAttribute(core, node, attr));

                // Get the constructor args
                layers[names[i]].args = ctorArgs;
            } else {
                layers[names[i]].args = [];
            }

            layers[names[i]].setters = {};
            setters = attrs
                .map(attr => prepAttribute(core, node, attr))
                .filter(isSetter);
            for (var j = setters.length; j--;) {
                layers[names[i]].setters[setters[j].name] = setters[j];
            }
        }

        return layers;
    };

    // When provided with the META, create the given LayerDict object
    //  - Filter out the ctor args (in order)
    //  - add name attribute to schema
    //  - store this array under the META name

    // LayerDict contains:
    //  name: [{schema (including name)}, {schema+name}]
    return createLayerDict;
});
