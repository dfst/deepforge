/*globals define */
/*jshint node:true, browser:true*/

define([
    'text!./metadata.json',
    './format',
    'plugin/GenerateJob/GenerateJob/GenerateJob',
    'deepforge/plugin/GeneratedFiles',
    'deepforge/Constants',
    'blob/BlobConfig',
    'underscore',
    'q'
], function (
    pluginMetadata,
    FORMATS,
    PluginBase,
    GeneratedFiles,
    CONSTANTS,
    BlobConfig,
    _,
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
    Export.prototype.main = async function (callback) {
        this.resetVariableNames();
        this.dataInputs = {};
        this.dataOutputs = {};

        // Get all the children and call generate exec file
        if (!this.isMetaTypeOf(this.activeNode, this.META.Pipeline)) {
            return callback(new Error('Only pipeline export is supported'), this.result);
        }
        this.activeNodeDepth = this.core.getPath(this.activeNode).split('/').length + 1;

        const files = new GeneratedFiles(this.blobClient);
        const name = this.core.getAttribute(this.activeNode, 'name');
        const staticInputDict = this.getCurrentConfig().staticInputs;
        await this.createPipelineFiles(this.activeNode, files);

        const staticInputData = Object.values(staticInputDict);
        await Promise.all(staticInputData.map(input => this.addStaticInput(input, files)));
        await this.createDefaultMainFile(this.activeNode, staticInputDict, files);

        const hash = await files.save(name);
        this.result.addArtifact(hash);
        this.result.setSuccess(true);
        callback(null, this.result);
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

    Export.prototype.getVariableNameFor = async function (nodeId) {
        if (!this.variableNameFor[nodeId]) {
            const node = await this.core.loadByPath(this.rootNode, nodeId);
            const basename = this.core.getAttribute(node, 'name')
                .replace(/[^a-zA-Z0-9]/g, '_');
            this.assignVariableTo(basename, nodeId);
        }
        return this.variableNameFor[nodeId];
    };

    Export.prototype.assignVariableTo = function (name/*ids*/) {
        const varName = this.getVariableName(name);
        const ids = Array.prototype.slice.call(arguments, 1);

        ids.forEach(id => this.variableNameFor[id] = varName);

        return varName;
    };

    Export.prototype.addStaticInput = async function (info, files) {
        // Get the static inputs and add them in artifacts/
        const node = await this.core.loadByPath(this.rootNode, info.id);
        const name = await this.getVariableNameFor(info.id);
        const dataInfo = this.core.getAttribute(node, 'data');
        files.addUserAsset(`artifacts/${name}`, dataInfo, info.credentials);
        return files;
    };

    Export.prototype.createDefaultMainFile = function (node, staticInputDict, files) {
        // Get the variable name for the pipeline
        const name = PluginBase.toUpperCamelCase(this.core.getAttribute(node, 'name'));
        const instanceName = this.getVariableName(name.toLowerCase());
        let initCode = null;
        return this.getAllInitialCode()
            .then(code => initCode = code)
            .then(() => this.core.loadChildren(node))
            .then(async nodes => {
                // Get code for each input
                const inputs = this.getPipelineInputs(nodes);
                const inputNames = await Promise.all(inputs.map(input => this.getVariableNameFor(input[1])));
                let argIndex = 1;
                const parseInputCode = (await Promise.all(inputs.map(async (input, i) => {
                    const [, , node] = input;
                    const inputName = inputNames[i];
                    const pathNameVar = this.getVariableName(`${inputName}_path`);
                    const type = this.core.getAttribute(node, 'type');
                    const id = this.core.getPath(node);
                    const artifactInfo = staticInputDict[id];

                    console.log(`checking if ${id} is static`, staticInputDict);
                    const lines = [
                        `${inputName} = deepforge.serialization.load('${type}', open(${pathNameVar}, 'rb'))`
                    ];

                    if (artifactInfo) {
                        const artifactName = await this.getVariableNameFor(artifactInfo.id);
                        lines.unshift(`${pathNameVar} = 'artifacts/${artifactName}'`);
                    } else {
                        lines.unshift(`${pathNameVar} = sys.argv[${argIndex}]`);
                        argIndex++;
                    }
                    return lines.join('\n');
                }))).join('\n');

                // Create code for saving outputs to outputs/
                const outputs = this.getPipelineOutputs(nodes);
                const outputNames = await Promise.all(outputs.map(output => this.getVariableNameFor(output[1])));

                const saveNames = outputs.map(output => {
                    const [, , node] = output;
                    const outputOp = this.core.getParent(this.core.getParent(node));
                    return this.core.getAttribute(outputOp, 'saveName');
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

                const mainPy = [
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
                files.addFile('main.py', mainPy);
                // Add file for storing results
                files.addFile('outputs/README.md', 'Results from the cli execution are stored here');
            });
    };

    Export.prototype.createPipelineFiles = async function (node, files) {
        const name = PluginBase.toUpperCamelCase(this.core.getAttribute(node, 'name'));
        // Generate the file for the pipeline in pipelines/

        let allOperations,
            operations,
            connections;

        const nodes = await this.core.loadChildren(node);
        const promises = nodes
            .filter(node => this.isMetaTypeOf(node, this.META.Operation))
            .map(operation => this.cacheDataNodes(operation));

        await Promise.all(promises);
        // Get the important node types and get all the code for the operations
        allOperations = this.getSortedOperations(nodes);
        operations = allOperations
            .filter(node => !this.isMetaTypeOf(node, this.META.Input))
            .filter(node => !this.isMetaTypeOf(node, this.META.Output));

        // For each operation, instantiate it with the respective arguments
        connections = nodes
            .filter(node => !this.isMetaTypeOf(node, this.META.Operation));

        connections.forEach(conn => {
            const srcId = this.core.getPointerPath(conn, 'src');
            const dstId = this.core.getPointerPath(conn, 'dst');
            // Get the src data name?
            // TODO
            this.assignVariableTo('result', srcId, dstId);
        });

        const createOps = operations.map(operation => this.createOperation(operation));
        const operationOutputs = await Promise.all(createOps);
        let code = [];

        for (let i = 0; i < operationOutputs.length; i++) {
            const output = operationOutputs[i];
            const [lines, opName, operation] = output;
            code = lines.concat(code);

            // execute it

            // Get the inputs of the operation
            let inputs = (await Promise.all(this.getCachedInputs(operation)
                .map(tuple => {
                    const [, id] = tuple;
                    const srcId = this.getSrcDataId(connections, id);
                    return this.getVariableNameFor(srcId);
                })))
                .join(',');

            // Get the outputs of the operation (assign variable names)
            const outputs = await this.getOutputs(operation);
            const outputNames = (await Promise.all(
                outputs.map(async tuple => {
                    const [, id] = tuple;
                    const variable = await this.getVariableNameFor(id);
                    return variable;
                })))
                .filter(name => !!name)
                .join(',');

            if (outputNames) {
                code.unshift(`${outputNames} = ${opName}.execute(${inputs})`);
            } else {
                code.unshift(`${opName}.execute(${inputs})`);
            }
        }

        // Import each operation
        let operationTypes = operations.map(node => {
            const base = this.core.getBase(node);
            return this.core.getAttribute(base, 'name');
        });
        operationTypes = _.uniq(operationTypes);
        operationTypes.forEach(type => code.unshift(`from operations import ${type}\n`));


        // Create the pipeline file
        const inputs = (await Promise.all(this.getPipelineInputs(allOperations)
            .map(tuple => this.getVariableNameFor(tuple[1]))))
            .join(', ');
        const outputs = (await Promise.all(this.getPipelineOutputs(allOperations)
            .map(tuple => this.getVariableNameFor(tuple[1]))))
            .filter(name => !!name)
            .join(', ');

        // Move imports to the top
        const importCode = code.filter(line => line.includes('import'));
        code = code.filter(line => !line.includes('import'));

        // Move all operation construction to the front
        const opInvocations = code.filter(line => line.includes('execute'));
        code = code.filter(line => !line.includes('execute'));
        code = code.concat(opInvocations);

        const filename = PluginBase.toSnakeCase(name);
        const pipelinePy = [
            importCode.join('\n'),
            '',
            `class ${name}():`,
            indent(`def execute(self${inputs && ', '}${inputs}):`),
            indent(indent(code.join('\n'))),
            indent(indent(`return ${outputs}`))
        ].join('\n');
        files.addFile(`pipelines/${filename}.py`, pipelinePy);
        files.appendToFile('pipelines/__init__.py', `from pipelines.${filename} import ${name}\n`);
        return Promise.all(operations.map(node => this.createOperationFiles(node, files)));
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
        return sorted.map(id => idToOperation[id]).reverse();
    };

    Export.prototype.createOperation = function (node) {
        const type = this.core.getAttribute(this.core.getBase(node), 'name');
        const name = this.core.getAttribute(node, 'name');
        const opName = this.getVariableName(name.toLowerCase());
        let lines = [];

        // Get the attributes, pointers
        return this.getReferencedContent(node)
            .then(refs => {
                // Create a map from ptr name to code
                const codeForRef = {};
                refs.forEach(pair => {
                    const [ptr, code] = pair;
                    codeForRef[ptr] = code;
                });

                const args = this.getOperationArguments(node)
                    .filter(arg => !(arg.isPointer && !arg.rawValue))
                    .map(arg => {
                        if (arg.isPointer) {
                            // Import the resource
                            arg.value = this.getVariableName(arg.value);
                            if (codeForRef[arg.name]) {
                                lines = lines.concat(codeForRef[arg.name].split('\n'));
                                lines.push(`${arg.value} = result`);
                            } else {
                                lines.push(`${arg.value} = None`);
                            }
                        }
                        return arg.value;
                    });

                // What about the inputs?
                // TODO

                // What about Input, Output types?
                // TODO
                lines.push(`${opName} = ${type}(${args.join(', ')})`);
                return [lines, opName, node];
            });
    };

    Export.prototype.getCurrentConfig = function () {
        var config = PluginBase.prototype.getCurrentConfig.call(this);
        config.staticInputs = config.staticInputs || {};
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

    // expose this utility function to format extensions
    var indent = Export.prototype.indent = function(text, spaces) {
        spaces = spaces || 3;
        return text.replace(/^/mg, new Array(spaces+1).join(' '));
    };

    Export.prototype.getOpIdFor = function (dataId) {
        var ids = dataId.split('/'),
            depth = ids.length;

        ids.splice(this.activeNodeDepth - depth);
        return ids.join('/');
    };

    return Export;
});
