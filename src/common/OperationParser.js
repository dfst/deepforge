/* globals define*/
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        // TODO: Load the brython script
        define(['./brython'], function(brython){
            return (root.OperationParser = factory(brython, console.assert));
        });
    } else if(typeof module === 'object' && module.exports) {
        var brython = require('./node-brython'),
            assert = require('assert');

        module.exports = (root.OperationParser = factory(brython, assert));
    }
}(this, function(brython, assert) {
    var OperationParser = {};

    // The provided tree gives us contexts which can have associated 'C'
    function traverse(node, fn) {
        var i;
        if (node.children) {
            for (i = node.children.length; i--;) {
                traverse(node.children[i], fn);
                fn(node.children[i]);
            }
        }
        if (node.C && node.C.tree) {
            for (i = node.C.tree.length; i--;) {
                traverse(node.C.tree[i], fn);
                fn(node.C.tree[i]);
            }
        }
    }

    function isClass(node) {
        return node.type === 'class';
    }

    function isInitFn(node) {
        return node.type === 'def' && node.name === '__init__';
    }

    function getBaseClass(node) {
        assert(node.type === 'class');
        return node.args.tree[0].tree[0].tree[0].value;
    }

    function parseOperationAst(root) {
        var schema = {
            name: null,
            base: null,
            methods: {}
        };

        traverse(root, node => {
            // Get the class for the given function
            if (isClass(node)) {
                schema.name = node.name;
                schema.base = getBaseClass(node);

                traverse(node.parent.node, n => {
                    if (n.type === 'def' && n.name === 'execute') {
                        console.log('found method');
                        console.log(Object.keys(n));

                        schema.methods[n.name] = n.args.map(arg => {
                            return {
                                name: arg,
                                type: null  // TODO
                            };
                        });
                        // TODO: get the outputs of the method...
                    }
                });
            }

            // How can I get from the class ctx to the methods?
            if (node.type === 'def') {
                var clazz = node.scope.C.tree.find(ctx => ctx.type === 'class');
            }
        });

        schema.inputs = schema.methods.execute;
        return schema;
    }

    OperationParser._getClass = function(src) {
    };

    OperationParser._getAst = function(src) {
        brython.$py_module_path['__main__']='./';
        var ast = brython.py2js(src,'__main__', '__main__', '__builtins__');
        return ast;
    };

    OperationParser.parse = function(src) {
        try {
            brython.$py_module_path['__main__']='./';
            var ast = brython.py2js(src,'__main__', '__main__', '__builtins__');
            var schema = parseOperationAst(ast);
            return schema;
        } catch (e) {
            return null;
        }
    };

    return OperationParser;
}));
