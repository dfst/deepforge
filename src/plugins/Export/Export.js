/*globals define */
/*jshint node:true, browser:true*/

define([
    'text!./metadata.json',
    'text!./deepforge.ejs',
    './format',
    'plugin/PluginBase',
    'deepforge/plugin/PtrCodeGen',
    'deepforge/Constants',
    'blob/BlobConfig',
    'underscore',
    'q'
], function (
    pluginMetadata,
    DeepForgeBaseCode,
    FORMATS,
    PluginBase,
    PtrCodeGen,
    CONSTANTS,
    BlobConfig,
    _,
    Q
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    var HEADER_LENGTH = 60,
        SKIP_ATTRS = {
            lineOffset: true,
            code: true
        },
        RESERVED = /^(and|break|do|else|elseifend|false|for|function|if|in|local|nil|not|orrepeat|return|then|true|until|while|print)$/,
        DeepForgeTpl = _.template(DeepForgeBaseCode);

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
        this.initRecords();
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

    Export.prototype.initRecords = function() {
        this.pluginMetadata = pluginMetadata;

        this._srcIdFor = {};  // input path -> output data node path

        this._nameFor = {};  // input path -> opname
        this._outputNames = {};
        this._baseNameFor = {};
        this._dataNameFor = {};  
        this._instanceNames = {};
        this._opBaseNames = {};
        this._fnNameFor = {};
        this._functions = {};  // function definitions for the operations

        // topo sort stuff
        this._nextOps = {};
        this._incomingCnts = {};

        this._operations = {};
        this.activeNodeId = null;
        this.activeNodeDepth = null;

        this.isInputOp = {};
        this._portCache = {};
        this.inputNode = {};
        this.outputDataToOpId = {};
        this.isOutputOp = {};
    };

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
        this.initRecords();

        // Get all the children and call generate exec file
        this.activeNodeId = this.core.getPath(this.activeNode);
        this.activeNodeDepth = this.activeNodeId.split('/').length + 1;

        if (this.isMetaTypeOf(this.activeNode, this.META.Execution)) {
            this.activeNodeDepth++;
        }

        return this.core.loadChildren(this.activeNode)
            .then(nodes => this.generateOutputFiles(nodes))
            .catch(err => callback(err))
            .then(hash => {
                this.result.addArtifact(hash);
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => callback(err));
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

                files = exporter.main(sections, staticInputs, config.extensionConfig);
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

    Export.prototype.createCodeSections = function (children) {
        // Convert opNodes' jobs to the nested operations
        var opNodes,
            nodes;

        return this.unpackJobs(children)
            .then(_nodes => {
                nodes = _nodes;
                opNodes = nodes
                    .filter(node => this.isMetaTypeOf(node, this.META.Operation));

                // Sort the connections to come first
                nodes
                    .map(node => [
                        node,
                        this.isMetaTypeOf(node, this.META.Transporter) ? -1 : 1
                    ])
                    .sort((a, b) => a[1] < b[1] ? -1 : 1);

                return Q.all(nodes.map(node => this.registerNode(node)));
            })
            .then(() => Q.all(opNodes
                .filter(n => {
                    var id = this.core.getPath(n);
                    return !this.isInputOp[id];
                })
                .map(node => this.createOperation(node)))
            )
            .then(operations => {
                var opDict = {},
                    firstOpIds;

                firstOpIds = opNodes.map(n => this.core.getPath(n))
                    .filter(id => !this._incomingCnts[id]);

                operations.forEach(op => opDict[op.id] = op);

                // Toposort!
                return this.sortOperations(opDict, firstOpIds);
            })
            .then(operations => this.generateCodeSections(operations))
            .fail(err => this.logger.error(err));
    };

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

    Export.prototype.generateCodeSections = function(sortedOps) {
        // Create the code sections:
        //  - operation definitions
        //  - pipeline definition
        //  - main
        var code = {},
            baseIds = [],
            outputOps = [],
            mainOps = [];

        // Define the operation functions...
        code.operations = {};
        for (var i = 0; i < sortedOps.length; i++) {
            if (this.isInputOp[sortedOps[i].id]) {
                continue;
            }
            if (!this.isOutputOp[sortedOps[i].id]) {
                if (!baseIds.includes(sortedOps[i].baseId)) {  // new definition
                    code.operations[sortedOps[i].basename] = this.defineOperationFn(sortedOps[i]);
                    baseIds.push(sortedOps[i].baseId);
                }
                mainOps.push(sortedOps[i]);
            } else {
                outputOps.push(sortedOps[i]);
            }
        }

        // Define the pipeline function
        code.pipelines = this.definePipelineFn(mainOps, outputOps);

        // Define the serializers/deserializers
        this.addCodeSerializers(code);

        // Define the main input names
        code.mainInputNames = Object.keys(this.isInputOp).map(id => this._nameFor[id]);

        // Add custom class definitions
        this.addCustomClasses(code);

        // Add custom layer definitions
        this.addCustomLayers(code);

        return code;
    };

    // expose this utility function to format extensions
    var indent = Export.prototype.indent = function(text, spaces) {
        spaces = spaces || 3;
        return text.replace(/^/mg, new Array(spaces+1).join(' '));
    };

    Export.prototype.defineOperationFn = function(operation) {
        var lines = [],
            args = operation.inputNames || [];

        // Create the function definition
        args.unshift('attributes');
        // Add the refs to the end
        args = args.concat(operation.refNames);

        args = args.join(', ');

        lines.push(`local function ${operation.basename}(${args})`);
        lines.push(indent(operation.code));
        lines.push('end');

        return lines.join('\n');
    };

    Export.prototype.definePipelineFn = function(sortedOps, outputOps) {
        var inputArgs = Object.keys(this.isInputOp).map(id => this._nameFor[id]),
            name = this.core.getAttribute(this.activeNode, 'name'),
            safename = getUniqueName(name, this._opBaseNames),
            results = [],
            result = {},
            returnStat,
            fnbody;

        // Call each function in order, with the respective attributes, etc
        fnbody = sortedOps.map(op => this.getOpInvocation(op)).join('\n');

        // Create the return statement
        results.push('\n\nresults = {}');
        outputOps.map(op => this.getOutputPair(op))
            .forEach(pair => results.push(`results['${pair[0]}'] = ${pair[1]}`));
        results.push('return results');
        returnStat = results.join('\n');

        // Merge the fnbody, return statement and the function def
        result[safename] = `local function ${safename} (${inputArgs.join(', ')})\n` +
            `${indent(fnbody + returnStat)}\nend`;

        return result;
    };

    Export.prototype.getOutputPair = function(operation) {
        var input = operation.inputValues[0].slice(),
            value;

        // Get the src operation name and data value name
        input[0] += '_results';
        value = input.join('.');
        return [this._nameFor[operation.id], value];
    };

    Export.prototype.addCodeSerializers = function(sections) {
        var loadNodes = {},
            saveNodes = {};

        // Add the serializer fn names for each input
        sections.serializerFor = {};
        sections.deserializerFor = {};

        Object.keys(this.isOutputOp).map(id => {
            var name = this._nameFor[id];
            sections.serializerFor[name] = `__save['${name}']`;
        });

        // Add the serializer definitions
        Object.keys(this.isInputOp).forEach(id => {
            var node = this.inputNode[id],
                name = this._nameFor[id];

            loadNodes[id] = node;
            sections.deserializerFor[name] = `__load['${this._nameFor[id]}']`;
        });

        sections.deserializers = this.createTorchFnDict(
            '__load',
            loadNodes,
            'deserialize',
            'path'
        );

        // Add the deserializer definitions
        Object.keys(this.outputDataToOpId).forEach(dataId => {
            var opId = this.outputDataToOpId[dataId];
            // The key is used for the output name resolution. The
            // value is used for the serialization fn look-up. So,
            // the key is the output operation id and the value is
            // the data port connected to the output operation
            saveNodes[opId] = this._portCache[this._srcIdFor[dataId]];
        });

        sections.serializers = this.createTorchFnDict(
            '__save',
            saveNodes,
            'serialize',
            'path, data'
        );

        // Add a saveOutputs method for convenience
        sections.serializeOutputsDef = [
            'local function __saveOutputs(data)',
            indent(Object.keys(this.isOutputOp).map(id => {
                var name = this._nameFor[id];
                return [
                    `print('saving ${name}...')`,
                    `${sections.serializerFor[name]}('${name}', data['${name}'])`
                ].join('\n');

            }).join('\n')),
            'end'
        ].join('\n');

        sections.serializeOutputs = '__saveOutputs(outputs)';
    };

    Export.prototype.createTorchFnDict = function(name, nodeDict, attr, args) {
        return [
            `local ${name} = {}`,
            Object.keys(nodeDict).map(id => {
                var node = nodeDict[id];
                return [
                    `${name}['${this._nameFor[id]}'] = function(${args})`,
                    indent(this.core.getAttribute(node, attr)),
                    'end'
                ].join('\n');
            }).join('\n')
        ].join('\n');
    };

    Export.prototype.addCustomClasses = function(sections) {
        var metaDict = this.core.getAllMetaNodes(this.rootNode),
            isClass,
            metanodes,
            classNodes,
            inheritanceLvl = {};

        this.logger.info('Creating custom layer file...');
        metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        isClass = this.getTypeDictFor('Complex', metanodes);

        // Store the dependencies for each class
        sections.classDependencies = {};

        classNodes = metanodes.filter(node => {
            var base = this.core.getBase(node),
                baseId,
                deps = [],
                name,
                count = 1;

            // Count the sets back to a class node
            while (base) {
                deps.push(this.core.getAttribute(base, 'name'));
                baseId = this.core.getPath(base);
                if (isClass[baseId]) {
                    inheritanceLvl[this.core.getPath(node)] = count;
                    name = this.core.getAttribute(node, 'name');
                    sections.classDependencies[name] = deps;
                    return true;
                }
                base = this.core.getBase(base);
                count++;
            }

            return false;
        });

        // Get the code definitions for each
        sections.classes = {};
        classNodes
            .sort((a, b) => {
                var aId = this.core.getPath(a),
                    bId = this.core.getPath(b);

                return inheritanceLvl[aId] > inheritanceLvl[bId];
            })
            .forEach(node => {
                var name = this.core.getAttribute(node, 'name'),
                    code = this.core.getAttribute(node, 'code');

                sections.classes[name] = code;
            });

        // order classes by dependency
        sections.orderedClasses = Object.keys(sections.classes)
            .sort((a, b) => {
                // if a depends on b, switch them (return 1)
                if (sections.classDependencies[a].includes(b)) {
                    return 1;
                }
                return -1;
            });
    };

    Export.prototype.addCustomLayers = function(sections) {
        var metaDict = this.core.getAllMetaNodes(this.rootNode),
            isCustomLayer,
            metanodes,
            customLayers;

        this.logger.info('Creating custom layer file...');
        metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        isCustomLayer = this.getTypeDictFor('CustomLayer', metanodes);

        customLayers = metanodes.filter(node =>
            this.core.getMixinPaths(node).some(id => isCustomLayer[id]));

        // Get the code definitions for each
        sections.layers = {};
        customLayers
            .map(layer => [
                this.core.getAttribute(layer, 'name'),
                this.core.getAttribute(layer, 'code')
            ])
            .forEach(pair => sections.layers[pair[0]] = pair[1]);
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

    Export.prototype.getVariableName = function (/*node*/) {
        var c = Object.keys(this.isInputOp).length;

        if (c !== 1) {
            return `input${c}`;
        }

        return 'input';
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

    // For each operation...
    //   - unpack the inputs from prev ops
    //   - add the attributes table (if used)
    //     - check for '\<attributes\>' in code
    //   - add the references
    //     - generate the code
    //     - replace the `return <thing>` w/ `<ref-name> = <thing>`
    Export.prototype.createOperation = function (node) {
        var id = this.core.getPath(node),
            baseId = this.core.getPath(this.core.getBase(node)),
            attrNames = this.core.getValidAttributeNames(node),
            operation = {};

        operation.name = this._nameFor[id];
        operation.basename = this._fnNameFor[baseId];
        operation.baseId = baseId;
        operation.id = id;
        operation.code = this.core.getAttribute(node, 'code');
        operation.attributes = {};
        for (var i = attrNames.length; i--;) {
            if (!SKIP_ATTRS[attrNames[i]]) {
                operation.attributes[attrNames[i]] = this.core.getAttribute(node, attrNames[i]);
            }
        }

        // Get all the input names (and sources)
        return this.core.loadChildren(node)
            .then(containers => {
                var inputs;

                inputs = containers
                    .find(cntr => this.isMetaTypeOf(cntr, this.META.Inputs));

                this.logger.info(`${operation.name} has ${containers.length} cntrs`);
                return this.core.loadChildren(inputs);
            })
            .then(data => {
                // Get the input names and sources
                var inputNames = data.map(d => this.core.getAttribute(d, 'name')),
                    ids = data.map(d => this.core.getPath(d)),
                    srcIds = ids.map(id => this._srcIdFor[id]);

                operation.inputNames = inputNames || [];
                operation.inputValues = inputNames.map((name, i) => {
                    var id = srcIds[i],
                        srcDataName = this._dataNameFor[id],
                        srcOpId = this.getOpIdFor(id),
                        srcOpName = this._nameFor[srcOpId];

                    if (this.isInputOp[srcOpId]) {
                        return this._nameFor[srcOpId];
                    } else {
                        return [srcOpName, srcDataName];
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
                return operation;
            });
    };

    Export.prototype.genPtrSnippet = function (ptrName, pId) {
        return this.getPtrCodeHash(pId)
            .then(hash => this.blobClient.getObjectAsString(hash));
    };

    Export.prototype.createHeader = function (title, length) {
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

    Export.prototype.genOperationCode = function (operation) {
        var header = this.createHeader(`"${operation.name}" Operation`),
            codeParts = [],
            body = [];

        codeParts.push(header);
        codeParts.push(`local ${operation.name}_results`);
        codeParts.push('do');

        if (operation.inputs.length) {
            body.push(operation.inputs.join('\n'));
        }

        if (operation.refs.length) {
            body.push(operation.refs.join('\n'));
        }

        body.push(operation.code);

        codeParts.push(indent(body.join('\n')));
        codeParts.push('end');
        codeParts.push('');

        operation.code = codeParts.join('\n');
        return operation;
    };

    _.extend(Export.prototype, PtrCodeGen.prototype);

    // Extra utilities for export types
    Export.prototype.INIT_CLASSES_FN = '__init_classes';
    Export.prototype.INIT_LAYERS_FN = '__init_layers';
    Export.prototype.getAllDefinitions = function (sections) {
        var code = [],
            classes,
            initClassFn,
            initLayerFn;

        classes = sections.orderedClasses
            // Create fns from the classes
            .map(name => this.indent(sections.classes[name])).join('\n');

        initClassFn = [
            `local function ${this.INIT_CLASSES_FN}()`,
            this.indent(classes),
            'end'
        ].join('\n');

        code = code.concat(initClassFn);

        // wrap the layers in a function
        initLayerFn = [
            `local function ${this.INIT_LAYERS_FN}()`,
            this.indent(_.values(sections.layers).join('\n\n')),
            'end'
        ].join('\n');
        code = code.concat(initLayerFn);

        // Add operation fn definitions
        code = code.concat(_.values(sections.operations));
        code = code.concat(_.values(sections.pipelines));

        // define deserializers, serializers
        code.push(sections.deserializers);
        code.push(sections.serializers);

        code.push(this.getDeepforgeObject());
        code.push('deepforge.initialize()');

        code.push(sections.serializeOutputsDef);
        return code.join('\n\n');
    };

    Export.prototype.getDeepforgeObject = function (content) {
        content = content || {};
        content.initCode = content.initCode || `${this.INIT_CLASSES_FN}()\n${'   '}${this.INIT_LAYERS_FN}()`;
        return DeepForgeTpl(content);
    };

    return Export;
});
