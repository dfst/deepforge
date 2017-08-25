/*globals Sk, define*/
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
    var MAIN_FN = 'execute';
    var CTOR_FN = '__init__';
    var OperationCode = function(code, filename) {
        this._lines = code.split('\n');
        this.filename = filename;
    };

    OperationCode.prototype.getName = function() {
        if (!this._schema) this.updateSchema();

        return this._schema.name;
    };

    OperationCode.prototype.getBase = function() {
        if (!this._schema) this.updateSchema();

        return this._schema.base;
    };

    OperationCode.prototype.getArguments = function(method) {
        if (!this._schema) this.updateSchema();
        if (!this._schema.methods[method]) return null;

        return this._schema.methods[method].inputs.slice();
    };

    OperationCode.prototype.getReturnValues = function(method) {
        if (!this._schema) this.updateSchema();
        if (!this._schema.methods[method]) return null;

        return this._schema.methods[method].outputs.slice();
    };

    OperationCode.prototype.getOutputs = function() {
        return this.getReturnValues(MAIN_FN);
    };

    OperationCode.prototype.getInputs = function() {
        return this.getArguments(MAIN_FN);
    };

    OperationCode.prototype.removeInput = function(name) {
        return this._removeIOCode(this.getInputs(), name);
    };

    OperationCode.prototype.removeOutput = function(name) {
        return this._removeIOCode(this.getOutputs(), name);
    };

    OperationCode.prototype._removeIOCode = function(ios, name) {
        var match,
            prev,
            line,
            startIndex,
            endIndex;

        for (var i = 0; i < ios.length; i++) {
            match = ios[i];
            prev = ios[i-1];

            if (match.name === name) {
                line = this._lines[match.pos.line-1];

                startIndex = prev ? prev.pos.col + prev.value.toString().length : match.pos.col;
                // only remove the following ',' if first input/output
                endIndex = i === 0 && i < ios.length-1 ? ios[i+1].pos.col :
                    match.pos.col + match.value.toString().length;
                this._lines[match.pos.line-1] = line.substring(0, startIndex) +
                    line.substring(endIndex);

                this.clearSchema();
                return match;
            }
        }
        return null;
    };

    OperationCode.prototype.addInput = function(name) {
        return this.addArgument(MAIN_FN, name);
    };

    OperationCode.prototype.addOutput = function(name) {
        return this.addReturnValue(MAIN_FN, name);
    };

    OperationCode.prototype.addArgument = function(method, name) {
        return this._addIOCode(method, name, true);
    };

    OperationCode.prototype.addReturnValue = function(method, name) {
        return this._addIOCode(method, name, false);
    };

    OperationCode.prototype.addMethod = function(method) {
        // TODO: get the position at the top of the class def
        var line = this._schema.body.pos.line - 1,
            indentSize = this._schema.body.pos.col,
            indent = new Array(indentSize+1).join(' '),
            snippet = indent + `def ${method}():`,
            body = new Array(indentSize+5).join(' ') + 'return';

        this._lines.splice(line-1, 0, '');
        this._lines.splice(line-1, 0, snippet);
        this._lines.splice(line, 0, body);

        this.clearSchema();
    };

    OperationCode.prototype.hasMethod = function(method) {
        if (!this._schema) this.updateSchema();
        return this._schema.methods[method];
    };

    OperationCode.prototype._addIOCode = function(method, name, isInput) {
        if (!this.hasMethod(method)) this.addMethod(method);

        this.updateSchema();

        var ios = this._schema.methods[method][isInput ? 'inputs' : 'outputs'].slice(),
            node = this._schema.methods[method].node,
            body = node.body,
            content = name,
            line,
            startIndex,
            endIndex,
            lineIndex;

        if (ios.length) {
            var pos = ios[ios.length-1].pos;
            var argLen = ios[ios.length-1].name.length;

            line = this._lines[pos.line-1];
            startIndex = pos.col + argLen;
            endIndex = pos.col + argLen;
            content = ', ' + name;
            lineIndex = pos.line - 1;
        } else if (isInput) {
            var first = body[0];
            lineIndex = first.lineno - 2;
            line = this._lines[lineIndex];
            this._lines[lineIndex] = line.replace(/\).*?:/, name + '):');

            return this.clearSchema();
        } else {
            var ret = body.find(node => this._isNodeType(node, 'Return_'));
            if (ret) {
                lineIndex = ret.lineno-1;
                startIndex = endIndex = ret.col_offset + 6;
                content = ' ' + content;
            } else {  // add to the end of the body (no return statement)
                var lastNode = body[body.length-1];
                var indent = new Array(lastNode.col_offset+1).join(' ');

                lineIndex = lastNode.lineno;
                this._lines.splice(lineIndex, 0, '');
                startIndex = endIndex = 0;
                content = indent + 'return ' + content;
            }
        }

        line = this._lines[lineIndex];
        this._lines[lineIndex] = line.substring(0, startIndex) + content +
            line.substring(endIndex);

        this.clearSchema();
    };

    OperationCode.prototype.rename = function(oldName, name) {
        if (!this.hasMethod(MAIN_FN)) return;

        var fnSchema = this._schema.methods[MAIN_FN];
        var startLine = fnSchema.bounds.start.line - 1;
        var endLine = fnSchema.bounds.end ? fnSchema.bounds.end.line - 1 : this._lines.length;
        var pattern = new RegExp('\\b' + oldName + '\\b');

        for (var i = startLine; i < endLine; i++) {
            this._lines[i] = this._lines[i].replace(pattern, name);
        }
        this.clearSchema();
    };

    OperationCode.prototype.getCode = function() {
        return this._lines.join('\n');
    };

    OperationCode.prototype.getAst = function () {
        if (this._ast) return this._ast;

        var filename = this.filename || 'operation.py';
        var cst = Sk.parse(filename, this.getCode()).cst;
        var ast = Sk.astFromParse(cst, filename);
        return this._ast = ast;
    };

    OperationCode.prototype._isNodeType = function (node, name) {
        return node.constructor.name === name;
    };

    OperationCode.prototype._parseFn = function (node, schema, next) {
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
        var ret = node.body.find(node => this._isNodeType(node, 'Return_'));
        var retVals = [];
        if (ret) {
            retVals = ret.value && this._isNodeType(ret.value, 'Tuple') ?
                ret.value.elts : [ret.value];
        }

        schema.methods[name].outputs = retVals
            .filter(node => !!node)
            .map((arg, index) => {
                var isNameNode = this._isNodeType(arg, 'Name');
                var name = isNameNode ? arg.id.v : 'result';
                if (!isNameNode && index > 0) {
                    name += '_' + index;
                }

                var value = this._isNodeType(arg, 'Num') ? arg.n.v : name;

                return {
                    name: name,
                    value: value,
                    pos: {
                        line: arg.lineno,
                        col: arg.col_offset
                    }
                };
            });

        // Get the function location
        schema.methods[name].bounds = {};
        schema.methods[name].bounds.start = {
            line: node.lineno,
            col: node.col_offset
        };

        if (next) {
            schema.methods[name].bounds.end = {
                line: next.lineno,
                col: next.col_offset
            };
        }

        schema.methods[name].node = node;
    };

    OperationCode.prototype.updateSchema = function () {
        if (!this._schema) this._schema = this.getSchema();
    };

    OperationCode.prototype.clearSchema = function () {
        this._ast = null;
        this._schema = null;
    };

    OperationCode.prototype.getSchema = function () {
        var schema = {
            name: null,
            base: null,
            methods: {}
        };
        var ast = this.getAst();

        // Find the class definition
        var classDef = ast.body.find(node => this._isNodeType(node, 'ClassDef'));
        if (classDef) {
            schema.name = classDef.name.v;

            // TODO: what if fn is inherited?
            var nodes = classDef.body;
            for (var i = 0; i < nodes.length; i++) {
                if (this._isNodeType(nodes[i], 'FunctionDef')) {
                    this._parseFn(nodes[i], schema, nodes[i+1]);
                }
            }
            schema.body = {
                pos: {
                    line: nodes[0].lineno,
                    col: nodes[0].col_offset,
                }
            };

        }

        schema.ast = ast;

        return schema;
    };

    /////////////////////// Attributes /////////////////////// 
    OperationCode.prototype.addAttribute = function(name, value) {
        return this._addIOCode(CTOR_FN, name, true);
    };

    OperationCode.prototype.removeAttribute = function(name) {
        // TODO
    };

    OperationCode.prototype.getAttributes = function() {
        return this.getArguments(CTOR_FN);
    };

    return OperationCode;
}));
