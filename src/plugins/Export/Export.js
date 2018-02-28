/*globals define */
/*jshint node:true, browser:true*/

define([
    'text!./metadata.json',
    './format',
    'plugin/GenerateJob/GenerateJob/GenerateJob',
    'deepforge/Constants',
    'blob/BlobConfig',
    'underscore',
    'q'
], function (
    pluginMetadata,
    FORMATS,
    PluginBase,
    CONSTANTS,
    BlobConfig,
    _,
    Q
) {
    'use strict';

    // This can basically be set up the same as the project when running only a
    // single operation.
    //
    // What kind of flexibility should be given to the users? Making a rest
    // endpoint could still use these operations and the file structure...
    //
    // We may only need to change the main file...
    //
    // Create the basic directory structure:
    //
    //   - operations/
    //   - operations/<operation>.py
    //   - inputs/
    //   - outputs/
    //   - main.py
    // TODO
    pluginMetadata = JSON.parse(pluginMetadata);
    /**
     * Initializes a new instance of Export.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin Export.
     * @constructor
     */
    var Export = function () {
        // Call base class' constructor.
        PluginBase.call(this);
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    Export.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    Export.prototype = Object.create(PluginBase.prototype);
    Export.prototype.constructor = Export;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    Export.prototype.main = function (callback) {
        this.resetVariableNames();
        this.dataInputs = {};
        this.dataOutputs = {};

        // Get all the children and call generate exec file
        if (!this.isMetaTypeOf(this.activeNode, this.META.Pipeline)) {
            return callback(new Error('Only pipeline export is supported'), this.result);
        }
        this.activeNodeDepth = this.core.getPath(this.activeNode).split('/').length + 1;

        const files = {};
        const name = this.core.getAttribute(this.activeNode, 'name');
        const staticInputs = this.getCurrentConfig().staticInputs;
        return this.createPipelineFiles(this.activeNode, files)
            .then(() => this.addStaticInputs(staticInputs, files))
            .then(() => this.createDefaultMainFile(this.activeNode, staticInputs, files))
            .then(() => this.createArtifact(name, files))
            .then(hash => {
                this.result.addArtifact(hash);
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .catch(err => callback(err));
    };

    Export.prototype.resetVariableNames = function () {
        this.variableNames = {};
        this.variableNameFor = {};
    };

    Export.prototype.getVariableName = function (basename) {
        let name = basename;
        let counter = 2;

        while (this.variableNames[name]) {
            name = basename + '_' + counter;
            counter++;
        }

        this.variableNames[name] = true;
        return name;
    };

    Export.prototype.getVariableNameFor = function (nodeId) {
        return this.variableNameFor[nodeId];
    };

    Export.prototype.assignVariableTo = function (name/*ids*/) {
        const varName = this.getVariableName(name);
        const ids = Array.prototype.slice.call(arguments, 1);

        ids.forEach(id => this.variableNameFor[id] = varName);

        return varName;
    };

    Export.prototype.addStaticInputs = function (ids, files={}) {
        // Get the static inputs and add them in artifacts/
        return Q.all(ids.map(id => this.core.loadByPath(this.rootNode, id)))
            .then(nodes => {
                nodes.forEach((node, i) => {
                    const name = this.getVariableNameFor(ids[i]);
                    const hash = this.getAttribute(node, 'data');
                    files._data[`artifacts/${name}`] = hash;
                });
                return files;
            });
    };

    Export.prototype.createDefaultMainFile = function (node, staticInputs, files={}) {
        // Get the variable name for the pipeline
        const name = this.core.getAttribute(node, 'name');
        const instanceName = this.getVariableName(name.toLowerCase());
        let initCode = null;
        return this.getAllInitialCode()
            .then(code => initCode = code)
            .then(() => this.core.loadChildren(node))
            .then(nodes => {
                // Get code for each input
                const inputs = this.getPipelineInputs(nodes);
                const inputNames = inputs.map(input => this.getVariableNameFor(input[1]));
                let argIndex = 1;
                const parseInputCode = inputs.map((input, i) => {
                    const [, , node] = input;
                    const inputName = inputNames[i];
                    const pathNameVar = this.getVariableName(`${inputName}_path`);
                    const type = this.getAttribute(node, 'type');
                    const id = this.core.getPath(node);
                    const isStatic = staticInputs.includes(id);

                    const lines = [
                        `${inputName} = deepforge.serialization.load('${type}', open(${pathNameVar}, 'rb'))`
                    ];

                    if (isStatic) {
                        lines.unshift(`${pathNameVar} = 'artifacts/${inputName}'`);
                    } else {
                        lines.unshift(`${pathNameVar} = sys.argv[${argIndex}]`);
                        argIndex++;
                    }
                    return lines.join('\n');
                }).join('\n');

                // Create code for saving outputs to outputs/
                const outputs = this.getPipelineOutputs(nodes);
                const outputNames = outputs.map(output => this.getVariableNameFor(output[1]));

                const saveNames = outputs.map(output => {
                    const [, , node] = output;
                    const outputOp = this.core.getParent(this.core.getParent(node));
                    return this.getAttribute(outputOp, 'saveName');
                });
                const printResults = outputNames
                    .map((name, i) => `print('  ${saveNames[i]}: ' + str(${name}))`);
                printResults.unshift('print(\'Results:\')');
                printResults.unshift('print()');

                const saveResults = outputs.map((output, i) => {  // save results
                    const name = saveNames[i];
                    const varName = outputNames[i];
                    return [
                        `with open('outputs/${name}.pkl', 'wb') as outfile:`,
                        indent(`deepforge.serialization.dump(${varName}, outfile)`),
                        `print('Saved ${name} to outputs/${name}.pkl')`
                    ].join('\n');
                });

                const saveOutputCode = printResults  // print results
                    .concat(['print()'])
                    .concat(saveResults).join('\n');

                let runPipeline = `${instanceName}.execute(${inputNames})`;
                if (outputNames.length) {
                    runPipeline = [
                        `${outputNames.join(', ')} = ${instanceName}.execute(${inputNames})`,
                        '',
                        saveOutputCode
                    ].join('\n');
                }

                files['main.py'] = [
                    'import deepforge',
                    // Get the input operations from the cli
                    'import sys',
                    '',
                    initCode,
                    '',
                    parseInputCode,
                    '',

                    // Import the pipeline
                    `from pipelines import ${name}`,
                    `${instanceName} = ${name}()`,
                    runPipeline
                ].join('\n');
                // Add file for storing results
                files['outputs/README.md'] = 'Results from the cli execution are stored here';
            });
    };

    Export.prototype.createPipelineFiles = function (node, files={}) {
        const name = this.core.getAttribute(node, 'name');
        // Generate the file for the pipeline in pipelines/
        return this.core.loadChildren(node)
            .then(nodes => {  // Assign variable names to all data
                const promises = nodes
                    .filter(node => this.isMetaTypeOf(node, this.META.Operation))
                    .map(operation => this.cacheDataNodes(operation));

                return Q.all(promises).then(() => nodes);
            })
            .then(nodes => {
                let code = [];

                // Topo sort the nodes
                const allOperations = this.getSortedOperations(nodes);
                const operations = allOperations
                    .filter(node => !this.isMetaTypeOf(node, this.META.Input))
                    .filter(node => !this.isMetaTypeOf(node, this.META.Output));

                // Import each operation
                let operationTypes = operations.map(node => {
                    const base = this.core.getBase(node);
                    return this.core.getAttribute(base, 'name');
                });
                operationTypes = _.uniq(operationTypes);
                operationTypes.forEach(type => code.push(`from operations import ${type}\n`));

                // For each operation, instantiate it with the respective arguments
                const connections = nodes
                    .filter(node => !this.isMetaTypeOf(node, this.META.Operation));

                connections.forEach(conn => {
                    const srcId = this.core.getPointerPath(conn, 'src');
                    const dstId = this.core.getPointerPath(conn, 'dst');
                    // Get the src data name?
                    // TODO
                    this.assignVariableTo('result', srcId, dstId);
                });

                operations.forEach(operation => {
                    // Create the operation
                    const [lines, opName] = this.createOperation(operation);
                    code = lines.concat(code);

                    // execute it

                    // Get the inputs of the operation
                    let inputs = this.getCachedInputs(operation)
                        .map(tuple => {
                            const [, id] = tuple;
                            const srcId = this.getSrcDataId(connections, id);
                            return this.getVariableNameFor(srcId);
                        })
                        .join(',');

                    // Get the outputs of the operation (assign variable names)
                    let outputs = this.getCachedOutputs(operation)
                        .map(tuple => {
                            const [, id] = tuple;
                            const variable = this.getVariableNameFor(id);
                            return variable;
                        })
                        .join(',');

                    if (outputs) {
                        code.unshift(`${outputs} = ${opName}.execute(${inputs})`);
                    } else {
                        code.unshift(`${opName}.execute(${inputs})`);
                    }
                });

                // Create the pipeline file
                const inputs = this.getPipelineInputs(allOperations)
                    .map(tuple => this.getVariableNameFor(tuple[1]))
                    .join(', ');
                const outputs = this.getPipelineOutputs(allOperations)
                    .map(tuple => this.getVariableNameFor(tuple[1]))
                    .join(', ');

                const importCode = code.filter(line => line.includes('import'));
                code = code.filter(line => !line.includes('import'));

                code.sort((a, b) => {
                    let [aVal, bVal] = [a, b].map(n => {
                        if (n.includes('execute')) return 2;
                        return 1;
                    });
                    return aVal < bVal ? -1 : 1;
                });

                const filename = PluginBase.toSnakeCase(name);
                files[`pipelines/${filename}.py`] = [
                    importCode.join('\n'),
                    '',
                    `class ${name}():`,
                    indent(`def execute(self${inputs && ', '}${inputs}):`),
                    indent(indent(code.join('\n'))),
                    indent(indent(`return ${outputs}`))
                ].join('\n');
                files['pipelines/__init__.py'] = files['pipelines/__init__.py'] || '';
                files['pipelines/__init__.py'] += `from pipelines.${filename} import ${name}\n`;

                return Q.all(operations.map(node => this.createOperationFiles(node, files)));
            });
    };

    Export.prototype.getPipelineInputs = function (nodes) {
        return nodes
            .filter(node => this.isMetaTypeOf(node, this.META.Input))
            .map(input => this.getCachedOutputs(input)[0]);
    };

    Export.prototype.getPipelineOutputs = function (nodes) {
        return nodes  // Get the srcPorts...
            .filter(node => this.isMetaTypeOf(node, this.META.Output))
            .map(output => this.getCachedInputs(output)[0]);
    };

    Export.prototype.cacheDataNodes = function (node) {
        const id = this.core.getPath(node);
        return this.getInputs(node)
            .then(inputs => this.dataInputs[id] = inputs)
            .then(() => this.getOutputs(node))
            .then(outputs => this.dataOutputs[id] = outputs);
    };

    Export.prototype.getCachedInputs = function (node) {
        const id = this.core.getPath(node);
        return this.dataInputs[id];
    };

    Export.prototype.getCachedOutputs = function (node) {
        const id = this.core.getPath(node);
        return this.dataOutputs[id];
    };

    Export.prototype.getInputs = function (node) {
        return PluginBase.prototype.getInputs.call(this, node)
            .then(inputs => inputs.map(tuple => [
                tuple[0],
                this.core.getPath(tuple[2]),
                tuple[2]
            ]));
    };

    Export.prototype.getOutputs = function (node) {
        return PluginBase.prototype.getOutputs.call(this, node)
            .then(outputs => outputs.map(tuple => [
                tuple[0],
                this.core.getPath(tuple[2]),
                tuple[2]
            ]));
    };

    Export.prototype.getSrcDataId = function (connections, dataId) {
        const matchingConns = connections
            .map(node => [
                this.core.getPointerPath(node, 'src'),
                this.core.getPointerPath(node, 'dst')
            ])
            .filter(endpoints => endpoints.includes(dataId));

        const [srcId] = matchingConns.pop();
        return srcId;
    };

    Export.prototype.getSortedOperations = function (nodes) {
        const operations = nodes
            .filter(node => this.isMetaTypeOf(node, this.META.Operation));

        // Record the dependencies and connections between nodes
        const depCountFor = {};
        const nextFor = {};
        operations.forEach(node => {
            depCountFor[this.core.getPath(node)] = 0;
            nextFor[this.core.getPath(node)] = [];
        });
        nodes.filter(node => !this.isMetaTypeOf(node, this.META.Operation))
            .forEach(conn => {
                // Get the operation id (not the data port)!
                const [srcId, dstId] = [
                    this.core.getPointerPath(conn, 'src'),
                    this.core.getPointerPath(conn, 'dst')
                ].map(id => this.getOpIdFor(id));
                depCountFor[dstId] += 1;
                nextFor[srcId].push(dstId);
            });

        // Get the 
        let ids = operations.map(node => this.core.getPath(node));
        const sorted = [];
        while (ids.length) {
            for (let i = ids.length; i--;) {
                if (depCountFor[ids[i]] === 0) {
                    sorted.push(ids[i]);

                    let nextIds = nextFor[ids[i]];
                    nextIds.forEach(id => depCountFor[id]--);
                    ids.splice(i, 1);
                }
            }
        }

        const idToOperation = {};
        operations.forEach(node => idToOperation[this.core.getPath(node)] = node);
        return sorted.map(id => idToOperation[id]);
    };

    Export.prototype.createOperation = function (node) {
        const lines = [];
        const type = this.core.getAttribute(this.core.getBase(node), 'name');
        const name = this.core.getAttribute(node, 'name');
        const opName = this.getVariableName(name.toLowerCase());

        // Get the attributes, pointers
        const args = this.getOperationArguments(node)
            .filter(arg => !(arg.isPointer && !arg.rawValue))
            .map(arg => {
                if (arg.isPointer) {
                    // Import the resource
                    arg.value = this.getVariableName(arg.value);
                    lines.push(`from resources import ${arg.name} as ${arg.value}`);
                }
                return arg.value;
            });

        // What about the inputs?
        // TODO

        // What about Input, Output types?
        // TODO

        lines.push(`${opName} = ${type}(${args.join(', ')})`);
        return [lines, opName];
    };

    Export.prototype.getCurrentConfig = function () {
        var config = PluginBase.prototype.getCurrentConfig.call(this);
        config.staticInputs = config.staticInputs || [];
        return config;
    };

    Export.prototype.getExporterFor = function (name) {
        var Exporter = function() {},
            format = FORMATS[name],
            exporter;

        Exporter.prototype = this;
        exporter = new Exporter();

        if (typeof format === 'function') {
            exporter.main = format;
        } else {
            _.extend(exporter, format);
        }
        return exporter;
    };

    Export.prototype.generateOutputFiles = function (children) {
        var name = this.core.getAttribute(this.activeNode, 'name');

        return this.createCodeSections(children)
            .then(sections => {
                // Get the selected format
                var config = this.getCurrentConfig(),
                    format = config.format || 'Basic CLI',
                    exporter,
                    staticInputs,
                    files;

                this.logger.info(`About to retrieve ${config.format} exporter`);
                exporter = this.getExporterFor(format);

                staticInputs = config.staticInputs.map(id => {
                    var opId = id.split('/').splice(0, this.activeNodeDepth).join('/'),
                        port = this._portCache[id];

                    return {
                        portId: id,
                        id: opId,
                        hash: this.core.getAttribute(port, 'data'),
                        name: this._nameFor[opId]
                    };
                });

                this.logger.info('Invoking exporter "main" function...');
                try {
                    files = exporter.main(sections, staticInputs, config.extensionConfig);
                } catch (e) {
                    this.logger.error(`Exporter failed: ${e.toString()}`);
                    throw e;
                }
                // If it returns a string, just put a single file
                if (typeof files === 'string') {
                    return this.blobClient.putFile(`${name}.lua`, files);
                } else {  // filename -> content
                    var artifact = this.blobClient.createArtifact(name),
                        objects = {};

                    Object.keys(files).forEach(key => {
                        if (BlobConfig.hashRegex.test(files[key])) {
                            objects[key] = files[key];
                            delete files[key];
                        }
                    });

                    return artifact.addFiles(files)
                        .then(() => artifact.addObjectHashes(objects))
                        .then(() => artifact.save());
                }
            });
    };

    //Export.prototype.createCodeSections = function (children) {
        //// Convert opNodes' jobs to the nested operations
        //var opNodes,
            //nodes;

        //return this.unpackJobs(children)
            //.then(_nodes => {
                //nodes = _nodes;
                //opNodes = nodes
                    //.filter(node => this.isMetaTypeOf(node, this.META.Operation));

                //// Sort the connections to come first
                //nodes
                    //.map(node => [
                        //node,
                        //this.isMetaTypeOf(node, this.META.Transporter) ? -1 : 1
                    //])
                    //.sort((a, b) => a[1] < b[1] ? -1 : 1);

                //return Q.all(nodes.map(node => this.registerNode(node)));
            //})
            //.then(() => Q.all(opNodes
                //.filter(n => {
                    //var id = this.core.getPath(n);
                    //return !this.isInputOp[id];
                //})
                //.map(node => this.createOperation(node)))
            //)
            //.then(operations => {
                //var opDict = {},
                    //firstOpIds;

                //firstOpIds = opNodes.map(n => this.core.getPath(n))
                    //.filter(id => !this._incomingCnts[id]);

                //operations.forEach(op => opDict[op.id] = op);

                //// Toposort!
                //return this.sortOperations(opDict, firstOpIds);
            //})
            //.then(operations => this.generateCodeSections(operations))
            //.fail(err => this.logger.error(err));
    //};

    Export.prototype.unpackJobs = function (nodes) {
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

    Export.prototype.sortOperations = function (operationDict, opIds) {
        var nextIds = [],
            sorted = opIds,
            dstIds,
            id;

        if (!opIds.length) {
            return [];
        }

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
        return sorted
            .map(id => operationDict[id])
            .filter(op => !!op)
            .concat(this.sortOperations(operationDict, nextIds));
    };

    // expose this utility function to format extensions
    var indent = Export.prototype.indent = function(text, spaces) {
        spaces = spaces || 3;
        return text.replace(/^/mg, new Array(spaces+1).join(' '));
    };

    Export.prototype.getOutputPair = function(operation) {
        var input = operation.inputValues[0].slice(),
            value;

        // Get the src operation name and data value name
        input[0] += '_results';
        value = input.join('.');
        return [this._nameFor[operation.id], value];
    };

    Export.prototype.getTypeDictFor = function (name, metanodes) {
        var isType = {};
        // Get all the custom layers
        for (var i = metanodes.length; i--;) {
            if (this.core.getAttribute(metanodes[i], 'name') === name) {
                isType[this.core.getPath(metanodes[i])] = true;
            }
        }
        return isType;
    };

    var toAttrString = function(attr) {
        if (/^\d+\.?\d*$/.test(attr) || /^(true|false|nil)$/.test(attr)) {
            return attr;
        }
        return `"${attr}"`;
    };

    Export.prototype.getOpInvocation = function(op) {
        var lines = [],
            attrs,
            refInits = [],
            args;

        attrs = '{' +
            Object.keys(op.attributes).map(key => `${key}=${toAttrString(op.attributes[key])}`)
            .join(',') +
        '}';

        lines.push(`local ${op.name}_attrs = ${attrs}`);
        args = (op.inputValues || [])
            .map(val => val instanceof Array ? `${val[0]}_results.${val[1]}` : val);

        args.unshift(op.name + '_attrs');
            
        // Create the ref init functions
        refInits = op.refs.map((code, index) => {
            return [
                `local function create_${op.refNames[index]}()`,
                indent(code),
                'end'
            ].join('\n');
        });
        lines = lines.concat(refInits);
        args = args.concat(op.refNames.map(name => `create_${name}()`));
        args = args.join(', ');
        lines.push(`local ${op.name}_results = ${op.basename}(${args})`);

        return lines.join('\n');
    };

    Export.prototype.getOutputName = function(node) {
        var basename = this.core.getAttribute(node, 'saveName');

        return getUniqueName(basename, this._outputNames, true);
    };

    Export.prototype.registerNode = function (node) {
        if (this.isMetaTypeOf(node, this.META.Operation)) {
            return this.registerOperation(node);
        } else if (this.isMetaTypeOf(node, this.META.Transporter)) {
            return this.registerTransporter(node);
        }
    };

    var getUniqueName = function(namebase, takenDict, unsafeAllowed) {
        var name,
            i = 2,
            isUnsafe = function(name) {
                return !unsafeAllowed && RESERVED.test(name);
            };

        if (!unsafeAllowed) {
            namebase = namebase.replace(/[^A-Za-z\d]/g, '_');
        }
        name = namebase;
        // Get a unique operation name
        while (takenDict[name] || isUnsafe(name)) {
            name = namebase + '_' + i;
            i++;
        }
        takenDict[name] = true;

        return name;
    };

    Export.prototype.registerOperation = function (node) {
        var name = this.core.getAttribute(node, 'name'),
            id = this.core.getPath(node),
            base = this.core.getBase(node),
            baseId = this.core.getPath(base),
            baseName = this.core.getAttribute(base, 'name');

        // If it is an Input/Output operation, assign it a variable name
        if (baseName === CONSTANTS.OP.INPUT) {
            this.isInputOp[id] = node;
            name = this.getVariableName(node);
        } else if (baseName === CONSTANTS.OP.OUTPUT) {
            this.isOutputOp[id] = node;
            name = this.getOutputName(node);
        } else {
            // get a unique operation instance name
            name = getUniqueName(name, this._instanceNames);
        }

        this._nameFor[id] = name;

        // get a unique operation base name
        if (!this._fnNameFor[baseId]) {
            name = this.core.getAttribute(base, 'name');
            name = getUniqueName(name, this._opBaseNames);
            this._fnNameFor[baseId] = name;
        }

        // For operations, register all output data node names by path
        return this.core.loadChildren(node)
            .then(cntrs => {
                var outputs = cntrs.find(n => this.isMetaTypeOf(n, this.META.Outputs)),
                    inputs = cntrs.find(n => this.isMetaTypeOf(n, this.META.Inputs));

                return Q.all([inputs, outputs].map(cntr => this.core.loadChildren(cntr)));
            })
            .then(data => {
                var inputs = data[0],
                    outputs = data[1];

                // Get the input type
                outputs.forEach(output => {
                    var dataId = this.core.getPath(output);

                    name = this.core.getAttribute(output, 'name');
                    this._dataNameFor[dataId] = name;

                    this._portCache[dataId] = output;
                });
                inputs.forEach(input => 
                    this._portCache[this.core.getPath(input)] = input
                );

                // Extra recording for input/output nodes in the pipeline
                if (this.isInputOp[id]) {
                    this.inputNode[id] = outputs[0];
                } else if (this.isOutputOp[id]) {
                    this.outputDataToOpId[this.core.getPath(inputs[0])] = id;
                }
            });
    };

    Export.prototype.registerTransporter = function (node) {
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
    };

    Export.prototype.getOpIdFor = function (dataId) {
        var ids = dataId.split('/'),
            depth = ids.length;

        ids.splice(this.activeNodeDepth - depth);
        return ids.join('/');
    };

    Export.prototype.genPtrSnippet = function (ptrName, pId) {
        return this.getPtrCodeHash(pId)
            .then(hash => this.blobClient.getObjectAsString(hash));
    };

    return Export;
});
