/* globals define, Sk*/
var isNodeJs = typeof module === 'object' && module.exports;
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define(['./skulpt.min'], function(){
            return (root.OperationParser = factory(Sk));
        });
    } else if(isNodeJs) {
        require('./skulpt.min');

        module.exports = (root.OperationParser = factory(Sk));
    }
}(this, function(Sk) {
    Sk.python3 = true;
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

    function isNodeType(node, name) {
        return node.constructor.name === name;
    }

    function parseFn(node, schema) {
        var name = node.name.v;

        schema.methods[name] = {};
        // add inputs
        schema.methods[name].inputs = node.args.args.map(arg => {
            return {
                name: arg.id.v,
                value: arg.id.v,
                pos: {
                    line: arg.lineno,
                    col: arg.col_offset
                }
            };
        });

        // add outputs
        var ret = node.body.find(node => isNodeType(node, 'Return_'));
        var retVals = [];
        if (ret) {
            retVals = ret.value && isNodeType(ret.value, 'Tuple') ?
                ret.value.elts : [ret.value];
        }

        schema.methods[name].outputs = retVals.map((arg, index) => {
            var isNameNode = isNodeType(arg, 'Name');
            var name = isNameNode ? arg.id.v : 'result';
            if (!isNameNode && index > 0) {
                name + '_' + index;
            }

            var value = isNodeType(arg, 'Num') ? arg.n.v : name;

            return {
                name: name,
                value: value,
                pos: {
                    line: arg.lineno,
                    col: arg.col_offset
                }
            };
        });
    }

    function parseOperationAst(ast) {
        var schema = {
            name: null,
            base: null,
            methods: {}
        };

        // Find the class definition
        var classDef = ast.body.find(node => isNodeType(node, 'ClassDef'));
        if (classDef) {
            schema.name = classDef.name.v;

            // TODO: what if fn is inherited?
            classDef.body
                .filter(node => isNodeType(node, 'FunctionDef'))
                .forEach(node => parseFn(node, schema));

        }

        schema.inputs = schema.methods.execute.inputs;
        schema.outputs = schema.methods.execute.outputs;
        schema.ast = ast;
        return schema;
    }

    OperationParser._traverse = traverse;
    OperationParser._getAst = function(src, filename) {
        filename = filename || 'operation.py';
        var cst = Sk.parse(filename, src).cst;
        var ast = Sk.astFromParse(cst, filename);
        return ast;
    };

    OperationParser.parse = function(src, filename) {
        //try {
            var ast = this._getAst(src, filename);
            return  parseOperationAst(ast);
        //} catch (e) {
            //console.error('operation parsing failed:', e);
            //return null;
        //}
    };

    return OperationParser;
}));
