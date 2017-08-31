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
    var OperationCode = function(code, filename) {
        this._lines = code.split('\n');
        this.filename = filename;
    };
    OperationCode.MAIN_FN = 'execute';
    OperationCode.CTOR_FN = '__init__';

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
        return this.getReturnValues(OperationCode.MAIN_FN);
    };

    OperationCode.prototype.getInputs = function() {
        return this.getArguments(OperationCode.MAIN_FN);
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

                startIndex = prev ? prev.pos.col + prev.len : match.pos.col;
                // only remove the following ',' if first input/output
                endIndex = i === 0 && i < ios.length-1 ? ios[i+1].pos.col :
                    match.pos.col + match.len;
                this._lines[match.pos.line-1] = line.substring(0, startIndex) +
                    line.substring(endIndex);

                this.clearSchema();
                return match;
            }
        }
        return null;
    };

    OperationCode.prototype.addInput = function(name) {
        return this.addArgument(OperationCode.MAIN_FN, name);
    };

    OperationCode.prototype.addOutput = function(name) {
        return this.addReturnValue(OperationCode.MAIN_FN, name);
    };

    OperationCode.prototype.addArgument = function(method, name, value) {
        var pos = this._addIOCode(method, name, true);

        if (value) {  // set the default value
            this.setAttributeDefault(name, value);
        }
        return pos;
    };

    OperationCode.prototype.setAttributeDefault = function(name, value) {
        return this.setDefaultValue(OperationCode.CTOR_FN, name, value);
    };

    OperationCode.prototype.setDefaultValue = function(method, name, value) {
        if (!this._schema) this.updateSchema();

        var inputs = this.getArguments(method);
        if (inputs === null) throw 'method "' + method + '" not found!';

        var input = inputs.find(node => node.name === name);
        if (!input) {
            throw 'method "' + method + '" does not have argument "' + 
                name + '" not found!';
        }

        if (input.default) this.removeDefaultValue(method, name);

        var pos = input.pos;
        var line = this._lines[pos.line-1];
        var col = pos.col + name.length;
        value = this._serializeAsPython(value);

        this._lines[pos.line-1] = line.substring(0, col) + '=' + value +
            line.substring(col);

        this.clearSchema();
    };

    OperationCode.types = {};
    OperationCode.types.string = value => '\'' + value + '\'';
    OperationCode.types.boolean = value => value ? 'True' : 'False';
    OperationCode.prototype._serializeAsPython = function(value) {
        var type = typeof value;
        if (OperationCode.types[type]) {
            return OperationCode.types[type](value);
        }
        return value.toString();
    };

    OperationCode.lengthOf = {};
    OperationCode.lengthOf.Str = node => node.s.v.length + 2;
    OperationCode.lengthOf.Num = node => node.n.v.toString().length;
    OperationCode.lengthOf.Name = node => node.id.v.length;
    OperationCode.prototype._getValueLength = function(node) {
        var type = node.constructor.name;
        if (OperationCode.lengthOf[type]) {
            return OperationCode.lengthOf[type](node);
        }
        return node.toString().length;
    };

    OperationCode.prototype.removeAttributeDefault = function(name) {
        return this.removeDefaultValue(OperationCode.CTOR_FN, name);
    };

    OperationCode.prototype.removeDefaultValue = function(method, name) {
        if (!this._schema) this.updateSchema();

        var inputs = this.getArguments(method);
        var input = inputs.find(node => node.name === name);

        // remove the default value
        if (input.default) {
            var start = input.pos.col + input.name.length;
            var end = input.default.col_offset + this._getValueLength(input.default);
            this._removeChunk(input.default.lineno-1, start, end);
        }
        this.clearSchema();
    };

    OperationCode.prototype._removeChunk = function(lineIndex, start, end) {
        var line = this._lines[lineIndex];

        this._lines[lineIndex] = line.substring(0, start) + line.substring(end);
    };

    OperationCode.prototype.addReturnValue = function(method, name) {
        return this._addIOCode(method, name, false);
    };

    OperationCode.prototype.addMethod = function(method) {
        // get the position at the top of the class def and
        // add a method right below it
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
            startIndex = line.match(/\).*?:/).index;
            this._lines[lineIndex] = line.replace(/\).*?:/, name + '):');

            this.clearSchema();
            return {
                line: lineIndex + 1,
                col: startIndex
            };
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
        return {
            line: lineIndex + 1,
            col: startIndex
        };
    };

    OperationCode.prototype.renameIn = function(method, oldName, name) {
        if (!this.hasMethod(method)) return;

        var fnSchema = this._schema.methods[method];
        var startLine = fnSchema.bounds.start.line - 1;
        var endLine = fnSchema.bounds.end ? fnSchema.bounds.end.line - 1 : this._lines.length;
        var pattern = new RegExp('\\b' + oldName + '\\b');

        for (var i = startLine; i < endLine; i++) {
            this._lines[i] = this._lines[i].replace(pattern, name);
        }
        this.clearSchema();
    };

    OperationCode.prototype.rename = function(oldName, name) {
        if (!this.hasMethod(OperationCode.MAIN_FN)) return;

        var fnSchema = this._schema.methods[OperationCode.MAIN_FN];
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
        var argLen = node.args.args.length;
        var offset = argLen - node.args.defaults.length;
        var len;

        schema.methods[name].inputs = node.args.args.map((arg, i) => {
            // get the default value and position
            i = i - offset;
            if (i >= 0) {
                var def = node.args.defaults[i];
                len = def.col_offset - arg.col_offset + 1;  // add the '='
            } else {
                len = arg.id.v.length;
            }
            return {
                name: arg.id.v,
                default: def,
                len: len,
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
                    len: value.toString().length,
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
        return this.addArgument(OperationCode.CTOR_FN, name, value);
    };

    OperationCode.prototype.removeAttribute = function(name) {
        return this._removeIOCode(this.getAttributes(), name);
    };

    OperationCode.prototype.getAttributes = function() {
        return this.getArguments(OperationCode.CTOR_FN);
    };

    return OperationCode;
}));
