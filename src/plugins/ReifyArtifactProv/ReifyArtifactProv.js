/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase
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

            const outputData = await this.createOutputOperation(pipeline, artifact);
            await this.addProvenanceOperation(pipeline, artifact, outputData);

            await this.save(`Created provenance pipeline of ${name}`);
            this.result.setSuccess(true);
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
            const dataInfo = this.core.getAttribute(data, 'data');
            this.core.setAttribute(input, 'data', dataInfo);

            const provId = this.core.getPointerPath(data, 'provenance');
            if (provId) {
                const provNode = await this.core.loadByPath(this.rootNode, provId);
                const provCopy = this.core.copyNode(provNode, input);
                this.core.setPointer(input, 'provenance', provCopy);
            }
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
            const impOpId = this.core.getPointerPath(artifact, 'provenance');
            if (!impOpId) return;
            const implicitOp = await this.core.loadByPath(this.rootNode, impOpId);
            const operationId = this.core.getPointerPath(implicitOp, 'operation');
            if (!operationId) {
                const name = this.core.getAttribute(implicitOp, 'name');
                throw new Error(`No operation found for ${impOpId} (${name})`);
            }
            return await this.core.loadByPath(this.rootNode, operationId);
        }

        async getOutputData(operation, artifact) {
            const outputs = await this.getOperationOutputs(operation);
            const dataInfo = this.core.getAttribute(artifact, 'data');
            return outputs.find(
                data => this.core.getAttribute(data, 'data') === dataInfo
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
