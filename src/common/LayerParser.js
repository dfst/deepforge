/* globals define*/
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define(['./lua'], function(luajs){
            return (root.LayerParser = factory(luajs));
        });
    } else if(typeof module === 'object' && module.exports) {
        var luajs = require('./lua');
        module.exports = (root.LayerParser = factory(luajs));
    }
}(this, function(luajs) {
    var LayerParser = {};

    //////////////////////// Setters //////////////////////// 
    var returnsSelf = function(fnNode){
        var stats = fnNode.block.stats,
            last = stats[stats.length-1];

        if (last.type === 'stat.return') {
            return last.nret[0].type === 'variable' && last.nret[0].val === 'self';
        }
        return false;
    };

    var isAttrSetter = function(node){
        if (node.type === 'stat.assignment' && node.lefts.length === 1) {
            var left = node.lefts[0];
            return left.type === 'expr.index' && left.self.val === 'self';
        }
        return false;
    };

    var getSettingAttrName = function(node){
        if (isAttrSetter(node)) {
            var left = node.lefts[0];
            return left.key.val;
        }
        return null;
    };

    var getSettingAttrValue = function(node){
        if (isAttrSetter(node)) {
            return node.right;
        }
        return null;
    };

    var isSetterMethod = function(curr, parent, className){
        if (parent && parent.type === 'stat.method') {
            // is it a fn w/ two statements (stats)
            if (parent.self.val === className && curr.type === 'function' &&
                curr.block.stats.length === 2) {
                // Is the first statement setting a value?
                return returnsSelf(curr) && getSettingAttrName(curr.block.stats[0]);  // does it return itself?
            }
        }
        return false;
    };

    var isFnArg = function(method, name) {
        return method.args.indexOf(name) !== -1;
    };

    var getSetterSchema = function(node, method) {
        var setterType,
            setterFn,
            value = getSettingAttrValue(node);

        if (value[0].type === 'variable' && isFnArg(method.func, value[0].val)) {
            setterType = 'arg';
            setterFn = method.key.val;
        } else {
            setterType = 'const';
            setterFn = {};
            setterFn[value[0].val] = method.key.val;
        }

        return {
            setterType,
            setterFn
        };
    };

    //////////////////////// Setters END //////////////////////// 

    var findInitParams = function(ast){
        // Find '__init' function
        var params;
        ast.block.stats.forEach(function(block){
            if(block.key && block.key.val == '__init' && block.func){
                params = block.func.args;
                if(params.length === 0 && block.func.varargs){
                    params[0] = 'params';
                }
            }
        });
        return params;
    };

    var isInitFn = function(node, className) {
        if (node.type === 'stat.method' && node.self.val === className) {
            return node.key.val === '__init';
        }
        return false;
    };

    var getClassAttrDefs = function(method) {
        var fn = method.func,
            dict = {},
            attr,
            right,
            value;

        luajs.codegen.traverse(curr => {
            if (isAttrSetter(curr)) {
                // Store the value if it is set to a constant
                attr = curr.lefts[0].key.val;
                right = curr.right[0];
                if (right.type.indexOf('const.') !== -1) {
                    value = right.val;

                    if (right.type === 'const.nil') {
                        value = null;
                    }

                    dict[attr] = value;
                }
            }
        })(fn);

        return dict;
    };

    var getAttrsAndVals = function(method) {
        // Given a method, get the 'self' attributes and the default values
        var fn = method.func,
            dict = {},
            varName,
            value,
            varUsageCnt = {};

        // Get the variables that are used only once (or updating themselves)
        luajs.codegen.traverse(curr => {
            if (curr.type === 'variable') {
                varUsageCnt[curr.val] = varUsageCnt[curr.val] ?
                    varUsageCnt[curr.val] + 1 : 1;
            }
        })(method);

        luajs.codegen.traverse(curr => {
            // If the variable is only used once and is 'or'-ed w/ a constant
            // during this use, we can infer that this is the default value
            if (curr.type === 'expr.op' && curr.op === 'op.or' &&
                curr.left.type === 'variable' && curr.right.type.indexOf('const') !== -1) {
                varName = curr.left.val;
                if (varUsageCnt[varName] === 1) {
                    value = curr.right.type === 'const.nil' ? null : curr.right.val;
                    dict[varName] = value;
                }
            }
        })(fn);

        return dict;
    };

    var copyAttrs = function(attrs, from, to) {
        for (var i = attrs.length; i--;) {
            to[attrs[i]] = from[attrs[i]];
        }
        return to;
    };

    var findTorchClass = function(ast){ 
        var torchClassArgs,  // args for `torch.class(...)`
            name = '',
            baseType,
            params = [],
            setters = {},
            defaults = {},
            paramDefs,
            attrDefs;

        if(ast.type == 'function'){
            ast.block.stats.forEach(function(func){
                if(func.type == 'stat.local' && func.right && func.right[0] &&
                  func.right[0].func && func.right[0].func.self &&
                  func.right[0].func.self.val == 'torch' &&
                  func.right[0].func.key.val == 'class'){

                    torchClassArgs = func.right[0].args.map(arg => arg.val);
                    name = torchClassArgs[0];
                    if(name !== ''){
                        name = name.replace('nn.', '');
                        params = findInitParams(ast);
                        if (torchClassArgs.length > 1) {
                            baseType = torchClassArgs[1].replace('nn.', '');
                        }
                    }
                }
            });
        }

        // Get the setters and defaults
        var setterNames,
            schema,
            values;

        luajs.codegen.traverse((curr, parent) => {
            var firstLine,
                attrName;

            // Record the setter functions
            if (isSetterMethod(curr, parent, name)) {
                firstLine = curr.block.stats[0];
                // just use the attribute attrName for now...
                attrName = getSettingAttrName(firstLine);

                // merge schemas
                schema = getSetterSchema(firstLine, parent);
                if (setters[attrName] && setters[attrName].setterType === 'const') {  // merge
                    for (var val in schema.setterFn) {
                        setters[attrName].setterFn[val] = schema.setterFn[val];
                    }
                } else {
                    setters[attrName] = schema;
                }
            } else if (isInitFn(curr, name)) {  // Record the defaults
                paramDefs = getAttrsAndVals(curr);
                attrDefs = getClassAttrDefs(curr);
            }

        })(ast);

        // Get the defaults for the params from defs
        if (paramDefs) {
            copyAttrs(params, paramDefs, defaults);
        }

        // Get the defaults for the setters from attrDefs
        if (attrDefs) {
            setterNames = Object.keys(setters);
            copyAttrs(setterNames, attrDefs, defaults);
        }

        // Remove any const setters w/ only one value and no default
        setterNames = Object.keys(setters);
        for (var i = setterNames.length; i--;) {
            schema = setters[setterNames[i]];
            if (schema.setterType === 'const') {
                values = Object.keys(schema.setterFn);
                if (values.length === 1 &&
                    // boolean setters can have the default value inferred
                    values[0] !== 'true' && values[0] !== 'false' &&
                    !defaults[setterNames[i]]) {

                    delete setters[setterNames[i]];
                }
            }
        }

        return {
            name,
            baseType,
            params,
            setters,
            defaults
        };
    };

    LayerParser.parse = function(text) {
        var ast = luajs.parser.parse(text);
        return findTorchClass(ast);
    };

    return LayerParser;
}));
