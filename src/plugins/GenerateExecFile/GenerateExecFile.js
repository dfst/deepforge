/*globals define, _*/
/*jshint node:true, browser:true*/

define([
    'text!./metadata.json',
    'plugin/PluginBase',
    'deepforge/plugin/PtrCodeGen',
    'deepforge/Constants',
    'q'
], function (
    pluginMetadata,
    PluginBase,
    PtrCodeGen,
    CONSTANTS,
    Q
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    var HEADER_LENGTH = 60;

    /**
     * Initializes a new instance of GenerateExecFile.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateExecFile.
     * @constructor
     */
    var GenerateExecFile = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;

        this._srcIdFor = {};  // input path -> output data node path

        this._nameFor = {};  // input path -> opname
        this._dataNameFor = {};  
        this._opNames = {};

        // topo sort stuff
        this._nextOps = {};
        this._incomingCnts = {};

        this._operations = {};
        this.activeNodeId = null;
        this.activeNodeDepth = null;

        this.isInputOp = {};
        this.isOutputOp = {};
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateExecFile.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateExecFile.prototype = Object.create(PluginBase.prototype);
    GenerateExecFile.prototype.constructor = GenerateExecFile;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateExecFile.prototype.main = function (callback) {
        // Get all the children and call generate exec file
        this.activeNodeId = this.core.getPath(this.activeNode);
        this.activeNodeDepth = this.activeNodeId.split('/').length + 1;

        if (this.isMetaTypeOf(this.activeNode, this.META.Execution)) {
            this.activeNodeDepth++;
        }

        return this.core.loadChildren(this.activeNode)
            .then(nodes => this.createExecFile(nodes))
            .then(code => this.blobClient.putFile('init.lua', code))
            .then(hash => {
                this.result.addArtifact(hash);
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => callback(err));
    };

    GenerateExecFile.prototype.createExecFile = function (children) {
        // Convert opNodes' jobs to the nested operations
        var opNodes,
            nodes;

        return this.unpackJobs(children)
            .then(_nodes => {
                nodes = _nodes;
                opNodes = nodes
                    .filter(node => this.isMetaTypeOf(node, this.META.Operation));

                return Q.all(nodes.map(node => this.registerNameAndData(node)));
            })
            .then(() => Q.all(opNodes
                .filter(n => {
                    var id = this.core.getPath(n);
                    return !this.isInputOp[id];
                })
                .map(node => this.createOperation(node)))
            )
            .then(operations => {
                var nextIds = opNodes.map(n => this.core.getPath(n))
                        .filter(id => !this._incomingCnts[id]);

                operations.forEach(op => this._operations[op.id] = op);

                // Toposort and concat!
                return this.combineOpNodes(nextIds);
            })
            .then(fnbody => {
                // add the function definition
                var inputArgs = Object.keys(this.isInputOp).map(id => this._nameFor[id]),
                    outputs = Object.keys(this.isOutputOp).map(id => this._nameFor[id]),
                    name = this.core.getAttribute(this.activeNode, 'name'),
                    safename = name.replace(/[^a-zA-Z0-9_]+/g, '_');

                return `local function ${safename} (${inputArgs.join(', ')})\n` +
                    fnbody.replace(/\n/gm, '\n   ') +
                    `   return ${outputs.join(', ')}\nend\n\n` +
                    `return ${safename}`;
            })
            .fail(err => this.logger.error(err));
    };

    GenerateExecFile.prototype.unpackJobs = function (nodes) {
        return Q.all(
            nodes.map(node => {
                if (!this.isMetaTypeOf(node, this.META.Job)) {
                    return node;
                }
                return this.core.loadChildren(node)
                    .then(children =>
                        children.find(c => this.isMetaTypeOf(c, this.META.Operation))
                    );
            })
        );
    };

    GenerateExecFile.prototype.combineOpNodes = function (opIds) {
        var nextIds = [],
            dstIds,
            code,
            id;

        // Combine all nodes with incoming cnts of 0
        code = opIds
            .filter(id => this._operations[id])
            .map(id => this._operations[id].code).join('\n');

        // Decrement all next ops
        dstIds = opIds.map(id => this._nextOps[id])
            .reduce((l1, l2) => l1.concat(l2), []);

        for (var i = dstIds.length; i--;) {
            id = dstIds[i];
            if (--this._incomingCnts[id] === 0) {
                nextIds.push(id);
            }
        }

        // append
        return [
            code,
            nextIds.length ? this.combineOpNodes(nextIds) : ''
        ].join('\n');
    };

    GenerateExecFile.prototype.getOutputName = function(/*node*/) {
        var c = Object.keys(this.isOutputOp).length;

        if (c !== 1) {
            return `output${c}`;
        }

        return 'output';
    };

    GenerateExecFile.prototype.getVariableName = function (/*node*/) {
        var c = Object.keys(this.isInputOp).length;

        if (c !== 1) {
            return `input${c}`;
        }

        return 'input';
    };

    GenerateExecFile.prototype.registerNameAndData = function (node) {
        var name = this.core.getAttribute(node, 'name'),
            id = this.core.getPath(node),
            base = this.core.getBase(node),
            baseName = this.core.getAttribute(base, 'name'),
            namebase,
            i = 2;

        if (this.isMetaTypeOf(node, this.META.Operation)) {

            // If it is an Input/Output operation, assign it a variable name
            if (baseName === CONSTANTS.OP.INPUT) {
                this.isInputOp[id] = true;
                name = this.getVariableName(node);
            } else if (baseName === CONSTANTS.OP.OUTPUT) {
                this.isOutputOp[id] = true;
                name = this.getOutputName(node);
            }

            // Get a unique operation name
            namebase = name;
            while (this._opNames[name]) {
                name = namebase + '_' + i;
                i++;
            }

            // register the unique name
            this._opNames[name] = true;
            this._nameFor[id] = name;

            // For operations, register all output data node names by path
            return this.core.loadChildren(node)
                .then(cntrs => {
                    var cntr = cntrs.find(n => this.isMetaTypeOf(n, this.META.Outputs));
                    return this.core.loadChildren(cntr);
                })
                .then(outputs => {
                    outputs.forEach(output => {
                        var dataId = this.core.getPath(output);

                        name = this.core.getAttribute(output, 'name');
                        this._dataNameFor[dataId] = name;
                    });
                });

        // For each input data node, register the associated output id
        } else if (this.isMetaTypeOf(node, this.META.Transporter)) {
            var outputData = this.core.getPointerPath(node, 'src'),
                inputData = this.core.getPointerPath(node, 'dst'),
                srcOpId = this.getOpIdFor(outputData),
                dstOpId = this.getOpIdFor(inputData);

            this._srcIdFor[inputData] = outputData;

            // Store the next operation ids for the op id
            if (!this._nextOps[srcOpId]) {
                this._nextOps[srcOpId] = [];
            }
            this._nextOps[srcOpId].push(dstOpId);

            // Increment the incoming counts for each dst op
            this._incomingCnts[dstOpId] = this._incomingCnts[dstOpId] || 0;
            this._incomingCnts[dstOpId]++;
        }
    };

    GenerateExecFile.prototype.getOpIdFor = function (dataId) {
        var ids = dataId.split('/'),
            depth = ids.length;

        ids.splice(this.activeNodeDepth - depth);
        return ids.join('/');
    };

    // For each operation...
    //   - unpack the inputs from prev ops
    //   - add the attributes table (if used)
    //     - check for '\<attributes\>' in code
    //   - add the references
    //     - generate the code
    //     - replace the `return <thing>` w/ `<ref-name> = <thing>`
    GenerateExecFile.prototype.createOperation = function (node) {
        var id = this.core.getPath(node),
            operation = {};

        operation.name = this._nameFor[id];
        operation.id = id;
        operation.code = this.core.getAttribute(node, 'code');

        // Update the 'code' attribute
        // Change the last return statement to assign the results to a table
        operation.code = this.assignResultToVar(operation.code,
            `${operation.name}_results`);

        // Get all the input names (and sources)
        return this.core.loadChildren(node)
            .then(containers => {
                var inputs;

                inputs = containers
                    .find(cntr => this.isMetaTypeOf(cntr, this.META.Inputs));

                this.logger.info(`${name} has ${containers.length} cntrs`);
                return this.core.loadChildren(inputs);
            })
            .then(data => {
                // Get the input names and sources
                var inputNames = data.map(d => this.core.getAttribute(d, 'name')),
                    ids = data.map(d => this.core.getPath(d)),
                    srcIds = ids.map(id => this._srcIdFor[id]);

                operation.inputs = inputNames.map((name, i) => {
                    var id = srcIds[i],
                        srcDataName = this._dataNameFor[id],
                        srcOpId = this.getOpIdFor(id),
                        srcOpName = this._nameFor[srcOpId];

                    if (this.isInputOp[srcOpId]) {
                        return `local ${name} = ${srcOpName}`;
                    } else {
                        return `local ${name} = ${srcOpName}_results.${srcDataName}`;
                    }
                });

                return operation;

            })
            .then(operation => {

                // For each reference, run the plugin and retrieve the generated code
                operation.refNames = [];

                if (!this.isInputOp[operation.id]) {
                    operation.refNames = this.core.getPointerNames(node)
                        .filter(name => name !== 'base');
                }

                var refs = operation.refNames
                    .map(ref => [ref, this.core.getPointerPath(node, ref)]);

                return Q.all(
                    refs.map(pair => this.genPtrSnippet.apply(this, pair))
                );
            })
            .then(codeFiles => {
                operation.refs = codeFiles;
                if (this.isOutputOp[operation.id]) {
                    // TODO reassign variables...
                    operation.code = this._nameFor[id]
                } else {
                    this.genOperationCode(operation);
                }
                return operation;
            });
    };

    GenerateExecFile.prototype.genPtrSnippet = function (ptrName, pId) {
        return this.getPtrCodeHash(pId)
            .then(hash => this.blobClient.getObjectAsString(hash))
            .then(code => this.createHeader(`creating ${ptrName}`, 40) + '\n' +
                this.assignResultToVar(code, ptrName));
    };

    GenerateExecFile.prototype.createHeader = function (title, length) {
        var len;
        title = ` ${title} `;
        length = length || HEADER_LENGTH;

        len = Math.max(
            Math.floor((length - title.length)/2),
            2
        );

        return [
            '',
            title,
            ''
        ].join(new Array(len+1).join('-')) + '\n';

    };

    GenerateExecFile.prototype.genOperationCode = function (operation) {
        var header = this.createHeader(`"${operation.name}" Operation`),
            codeParts = [];

        codeParts.push(header);
        codeParts.push(`local ${operation.name}_results`);
        codeParts.push('do');

        if (operation.inputs.length) {
            codeParts.push(operation.inputs.join('\n   '));
        }

        if (operation.refs.length) {
            codeParts.push(operation.refs.join('\n   '));
        }

        codeParts.push('   ' + operation.code.replace(/\n/gm, '\n   '));
        codeParts.push('end');
        codeParts.push('');

        operation.code = codeParts.join('\n');
        return operation;
    };

    GenerateExecFile.prototype.assignResultToVar = function (code, name) {
        var i = code.lastIndexOf('return');

        return code.substring(0, i) +
            code.substring(i)
                .replace('return', `${name} = `);
    };

    _.extend(GenerateExecFile.prototype, PtrCodeGen.prototype);

    return GenerateExecFile;
});
