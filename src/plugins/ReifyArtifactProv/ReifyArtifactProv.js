/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/PluginBase',
    'deepforge/plugin/ExecutionHelpers',
    'text!./metadata.json',
], function (
    PluginBase,
    ExecutionHelpers,
    pluginMetadata,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    class ReifyArtifactProv extends PluginBase {
        constructor() {
            super();
            this.pluginMetadata = pluginMetadata;
        }

        async main(callback) {
            const {artifactId} = this.getCurrentConfig();
            const artifact = await this.core.loadByPath(this.rootNode, artifactId);
            if (!artifact) {
                throw new Error(`Could not load artifact: ${artifactId}`);
            }

            const name = this.core.getAttribute(artifact, 'name');
            const pipeline = this.core.createNode({
                base: this.META.Pipeline,
                parent: this.activeNode,
            });
            this.core.setAttribute(pipeline, 'name', `Provenance of ${name}`);

            const outputOp = await this.createOutputOperation(pipeline, artifact);
            const [input] = await this.getOperationInputs(outputOp);
            await this.addProvenanceOperation(pipeline, input);

            await this.save(`Created provenance pipeline of ${name}`);
            this.result.setSuccess(true);
            this.createMessage(pipeline, 'New Provenance Pipeline');
            callback(null, this.result);
        }

        async addProvenanceOperation(pipeline, input) {
            const operation = await this.getProvAsOperation(input);
            const newOperation = this.core.copyNode(operation, pipeline);
            const outputData = await this.getOutputData(newOperation, input);
            if (!outputData) {
                throw new Error(`Could not find output in ${this.core.getPath(operation)} referencing data ${this.core.getAttribute(input, 'data')}`);
            }
            this.connect(pipeline, outputData, input);

            const inputs = await this.getOperationInputs(newOperation);
            await Promise.all(
                inputs.map(input => this.addProvenanceOperation(pipeline, input))
            );
            // TODO: should I create a new meta type for each?
        }

        async createOutputOperation(pipeline, data) {
            const output = this.core.createNode({
                parent: pipeline,
                base: this.META.Output,
            });
            const [input] = await this.getOperationInputs(output);
            const helpers = new ExecutionHelpers(this.core, this.rootNode);
            await helpers.setDataContents(input, data);
            const name = this.core.getAttribute(data, 'name');
            this.core.setAttribute(output, 'saveName', name);
            return output;
        }

        async getOperationInputs(operation) {
            const inputs = (await this.core.loadChildren(operation))
                .find(node => this.core.isTypeOf(node, this.META.Inputs));
            return this.core.loadChildren(inputs);
        }

        async getOperationOutputs(operation) {
            const outputs = (await this.core.loadChildren(operation))
                .find(node => this.core.isTypeOf(node, this.META.Outputs));
            return this.core.loadChildren(outputs);
        }

        async getProvAsOperation(artifact) {
            const implOpId = this.core.getPointerPath(artifact, 'provenance');
            if (!implOpId) return;
            const implicitOp = await this.core.loadByPath(this.rootNode, implOpId);
            const operationId = this.core.getPointerPath(implicitOp, 'operation');
            if (!operationId) {
                const name = this.core.getAttribute(implicitOp, 'name');
                throw new Error(`No operation found for ${implOpId} (${name})`);
            }
            return await this.core.loadByPath(this.rootNode, operationId);
        }

        async getOutputData(operation, artifact) {
            const outputs = await this.getOperationOutputs(operation);
            const provOutput = this.core.getAttribute(artifact, 'provOutput');
            return outputs.find(
                data => this.core.getAttribute(data, 'name') === provOutput
            );
        }

        async connect(parent, src, dst) {
            const base = this.META.Transporter;
            const connection = this.core.createNode({parent, base});
            this.core.setPointer(connection, 'src', src);
            this.core.setPointer(connection, 'dst', dst);
            return connection;
        }
    }

    ReifyArtifactProv.metadata = pluginMetadata;

    return ReifyArtifactProv;
});
