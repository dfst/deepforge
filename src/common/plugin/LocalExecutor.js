/* globals define*/
// This is an 'executor' containing the implementations of all local operations
// These are all primitives in DeepForge
define([
    'deepforge/Constants',
], function(
    CONSTANTS,
) {
    'use strict';
    var LocalExecutor = function() {
    };

    LocalExecutor.prototype[CONSTANTS.OP.INPUT] = async function(node) {
        // Get the dataInfo for the output node
        const outputContainer = (await this.core.loadChildren(node))
            .find(cntr => this.isMetaTypeOf(cntr, this.META.Outputs));

        const jobLogger = new JobLogger(this.core, this.core.getParent(node));
        jobLogger.log('Passing data reference to the subsequent jobs.');
        const dataNodes = await this.core.loadChildren(outputContainer);
        const dataInfo = this.core.getAttribute(dataNodes[0], 'data');

        // Pass the dataInfo to the next nodes
        const outputs = (await this.getOutputs(node))
            .map(tuple => {
                const [/*name*/, /*type*/, node] = tuple;
                return node;
            });

        outputs.forEach(output => this.core.setAttribute(output, 'data', dataInfo));
        jobLogger.append('Operation complete.');
    };

    LocalExecutor.prototype._getSaveDir = async function () {
        const children = await this.core.loadChildren(this.rootNode);
        const dataPath = this.core.getPath(this.META.Data);

        // Find a node in the root that can contain data nodes
        const containers = children.filter(child => {
            var metarule = this.core.getChildrenMeta(child);
            return metarule && metarule[dataPath];
        });

        const saveDir = containers.find(c =>
            this.core.getAttribute(c, 'name').toLowerCase().includes('artifacts')
        ) || containers[0];

        return saveDir || this.rootNode;  // default to rootNode
    };

    LocalExecutor.prototype[CONSTANTS.OP.OUTPUT] = async function(node) {
        const artifactsDir = await this._getSaveDir();
        const artifacts = await this.core.loadChildren(artifactsDir);
        const currNameHashPairs = artifacts
            .map(node => [
                this.core.getAttribute(node, 'name'),
                this.core.getAttribute(node, 'data')
            ]);
        const inputs = await this.getInputs(node);
        const ids = inputs.map(i => this.core.getPath(i[2]));
        const incomingData = Object.values(this.nodes)
            .filter(node => this.isMetaTypeOf(node, this.META.Transporter))
            .filter(node => ids.includes(this.core.getPointerPath(node, 'dst')))
            .map(node => this.core.getPointerPath(node, 'src'))
            .map(id => this.nodes[id]);

        // Remove nodes that already exist
        const dataNodes = incomingData.filter(dataNode => {
            const hash = this.core.getAttribute(dataNode, 'data');
            const name = this.core.getOwnAttribute(node, 'saveName') ||
                    this.core.getAttribute(dataNode, 'name');

            return !(currNameHashPairs
                .find(pair => pair[0] === name && pair[1] === hash));
        });

        const jobLogger = new JobLogger(this.core, this.core.getParent(node));
        jobLogger.log('About to save output artifacts.');
        const saveDir = `${this.projectId}/artifacts/`;
        const dstStorage = await this.getStorageClient();
        jobLogger.append(`Saving output data to ${dstStorage.name}...`);

        for (let i = dataNodes.length; i--;) {
            const artifact = this.core.copyNode(dataNodes[i], artifactsDir);
            const createdAt = Date.now();
            const originalData = JSON.parse(this.core.getAttribute(dataNodes[i], 'data'));

            const name = this.core.getOwnAttribute(node, 'saveName') ||
                this.core.getAttribute(dataNodes[i], 'name');

            const srcStorage = this.isPipelineInput(dataNodes[i]) ?
                await this.getStorageClientForInputData(originalData)
                : dstStorage;
            const content = await srcStorage.getFile(originalData);
            const userAsset = await dstStorage.putFile(saveDir + name, content);

            this.core.setAttribute(artifact, 'data', JSON.stringify(userAsset));
            this.core.setAttribute(artifact, 'name', name);
            this.core.setAttribute(artifact, 'createdAt', createdAt);
        }

        this.logger.info(`Saved ${dataNodes.length} artifacts in ${this.projectId}.`);
        jobLogger.append(`Saved output data to ${dstStorage.name}`);
    };

    LocalExecutor.prototype.isPipelineInput = function(node) {
        return this.isMetaTypeOf(node, this.META.Input);
    };

    // Helper methods
    LocalExecutor.prototype.getLocalOperationType = function(node) {
        for (let i = LocalExecutor.OPERATIONS.length; i--;) {
            const type = LocalExecutor.OPERATIONS[i];
            if (this.isMetaTypeOf(node, this.META[type])) {
                return type;
            }
        }
        return null;
    };

    LocalExecutor.prototype.isLocalOperation = function(node) {
        return !!this.getLocalOperationType(node);
    };

    LocalExecutor.OPERATIONS = Object.keys(LocalExecutor.prototype)
        .filter(name => name.indexOf('_') !== 0)
        .filter(name => name !== 'isLocalOperation' && name !== 'getLocalOperationType');
    
    class JobLogger{
        constructor(core, node) {
            this.core = core;
            this.job = node;
        }

        append(text) {
            const stdout = this.core.getAttribute(this.job, 'stdout') + text + '\n';
            this.core.setAttribute(this.job, 'stdout', stdout);
        }

        log(text) {
            this.core.setAttribute(this.job, 'stdout', text + '\n');
        }
    }

    return LocalExecutor;
});
