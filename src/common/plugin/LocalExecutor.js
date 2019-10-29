/* globals define*/
// This is an 'executor' containing the implementations of all local operations
// These are all primitives in DeepForge
define([
    'deepforge/Constants',
    'deepforge/storage/index',
], function(
    CONSTANTS,
    Storage,
) {
    'use strict';
    var LocalExecutor = function() {
    };

    LocalExecutor.prototype[CONSTANTS.OP.INPUT] = function(node) {
        // Get the hash from the output node
        var hash;
        return this.core.loadChildren(node)
            .then(cntrs => {
                // Get the output container and load it's children
                var output = cntrs
                    .find(cntr => {
                        var metaNode = this.core.getMetaType(cntr),
                            metaName = this.getAttribute(metaNode, 'name');
                        return metaName === 'Outputs';
                    });
                return this.core.loadChildren(output);
            })
            .then(dataNodes => {
                hash = this.getAttribute(dataNodes[0], 'data');
                return this.getOutputs(node);
            })
            .then(outputTuples => {
                var outputs = outputTuples.map(tuple => tuple[2]),
                    paths;

                paths = outputs.map(output => this.core.getPath(output));
                // Get the 'data' hash and store it in the output data ports
                this.logger.info(`Loading blob data (${hash}) to ${paths.map(p => `"${p}"`)}`);
                outputs.forEach(output => this.core.setAttribute(output, 'data', hash));

                this.onOperationComplete(node);
            });
    };

    LocalExecutor.prototype.ArtifactFinder = function(node) {
        // Check the save dir for a node with the given name
        // that has the given type
        var hash,
            typeId = this.core.getPointerPath(node, 'type'),
            type,
            artifactName = this.getAttribute(node, 'artifactName');

        return this.core.loadByPath(this.rootNode, typeId)
            .then(_type => {
                type = _type;
                return this._getSaveDir();
            })
            .then(saveDir => this.core.loadChildren(saveDir))
            .then(artifacts => {
                return artifacts.find(artifact =>
                    this.getAttribute(artifact, 'name') === artifactName &&
                        this.isMetaTypeOf(artifact, type));
            })
            .then(matchingArtifact => {
                hash = matchingArtifact && this.getAttribute(matchingArtifact, 'data');
                // If no hash, just continue (the subsequent ops will receive 'nil')
                if (!hash) {
                    return this.onOperationComplete(node);
                } else {
                    return this.getOutputs(node)
                        .then(outputPairs => {
                            var outputs = outputPairs.map(pair => pair[2]);
                            // Get the 'data' hash and store it in the output data ports
                            outputs.forEach(output => this.setAttribute(output, 'data', hash));

                            this.onOperationComplete(node);
                        });
                }
            });
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
            this.getAttribute(c, 'name').toLowerCase().includes('artifacts')
        ) || containers[0];

        return saveDir || this.rootNode;  // default to rootNode
    };

    LocalExecutor.prototype[CONSTANTS.OP.OUTPUT] = async function(node) {
        const artifactsDir = await this._getSaveDir();
        const artifacts = await this.core.loadChildren(artifactsDir);
        const currNameHashPairs = artifacts
            .map(node => [
                this.getAttribute(node, 'name'),
                this.getAttribute(node, 'data')
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
            const hash = this.getAttribute(dataNode, 'data');
            const name = this.core.getOwnAttribute(node, 'saveName') ||
                    this.getAttribute(dataNode, 'name');

            return !(currNameHashPairs
                .find(pair => pair[0] === name && pair[1] === hash));
        });

        this.logger.info(`Saving ${dataNodes.length} artifacts in ${this.projectId}.`);
        const saveDir = `${this.projectId}/artifacts/`;
        for (let i = dataNodes.length; i--;) {
            const artifact = this.core.createNode({
                base: this.META.Data,
                parent: artifactsDir,
            });
            const name = this.core.getOwnAttribute(node, 'saveName') ||
                this.getAttribute(dataNodes[i], 'name');
            const createdAt = Date.now();
            const originalData = this.getAttribute(dataNodes[i], 'data');
            const userAsset = await Storage.copy(originalData, saveDir + name);

            this.setAttribute(artifact, 'data', userAsset);
            this.setAttribute(artifact, 'name', name);
            this.setAttribute(artifact, 'createdAt', createdAt);
            this.setPointer(artifact, 'origin', inputs[0][2]);
        }

        this.onOperationComplete(node);
    };

    // Helper methods
    LocalExecutor.prototype.getLocalOperationType = function(node) {
        for (let i = LocalExecutor.OPERATIONS.length; i--;) {
            const type = LocalExecutor.OPERATIONS[i];
            if (!this.META[type]) {
                this.logger.warn(`Missing local operation: ${type}`);
                continue;
            }
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
    
    return LocalExecutor;
});
