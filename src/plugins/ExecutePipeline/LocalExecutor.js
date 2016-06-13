/* globals define*/
// This is an 'executor' containing the implementations of all local operations
// These are all primitives in DeepForge
define([
], function(
) {
    'use strict';
    var LocalExecutor = function() {
    };

    // Should these be in lua?
    LocalExecutor.prototype.ArtifactLoader = function(node) {
        // Get the hash from the output node
        var hash;
        return this.core.loadChildren(node)
            .then(cntrs => {
                // Get the output container and load it's children
                var output = cntrs
                    .find(cntr => {
                        var metaNode = this.core.getMetaType(cntr),
                            metaName = this.core.getAttribute(metaNode, 'name');
                        return metaName === 'Outputs';
                    });
                return this.core.loadChildren(output);
            })
            .then(dataNodes => {
                hash = this.core.getAttribute(dataNodes[0], 'data');
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
            artifactName = this.core.getAttribute(node, 'artifactName');

        return this.core.loadByPath(this.rootNode, typeId)
            .then(_type => {
                type = _type;
                return this._getSaveDir();
            })
            .then(saveDir => this.core.loadChildren(saveDir))
            .then(artifacts => {
                return artifacts.find(artifact =>
                    this.core.getAttribute(artifact, 'name') === artifactName &&
                        this.isMetaTypeOf(artifact, type));
            })
            .then(matchingArtifact => {
                hash = matchingArtifact && this.core.getAttribute(matchingArtifact, 'data');
                // If no hash, just 
                if (!hash) {
                    return this.onOperationComplete(node);
                } else {
                    return this.getOutputs(node)
                        .then(outputTuples => {
                            var outputs = outputTuples.map(tuple => tuple[2]),
                                paths;

                            paths = outputs.map(output => this.core.getPath(output));
                            // Get the 'data' hash and store it in the output data ports
                            this.logger.info(`Loading blob data (${hash}) to ${paths.map(p => `"${p}"`)}`);

                            outputs.forEach(output => this.core.setAttribute(output, 'data', hash));

                            this.onOperationComplete(node);
                        });
                }
            });
    };

    LocalExecutor.prototype._getSaveDir = function () {
        return this.core.loadChildren(this.rootNode)
            .then(children => {
                var execPath = this.core.getPath(this.META.Data),
                    containers,
                    saveDir;

                // Find a node in the root that can contain only executions
                containers = children.filter(child => {
                    var metarule = this.core.getChildrenMeta(child);
                    return metarule && metarule[execPath];
                });

                if (containers.length > 1) {
                    saveDir = containers.find(c =>
                        this.core.getAttribute(c, 'name').toLowerCase().indexOf('artifacts') > -1
                    ) || containers[0];
                }

                return saveDir || this.rootNode;  // default to rootNode
            });
    };

    LocalExecutor.prototype.Save = function(node) {
        var nodeId = this.core.getPath(node),
            parentNode;
        
        // Get the input node
        this.logger.info('Calling save operation!');
        return this._getSaveDir()
            .then(_saveDir => {
                parentNode = _saveDir;
                return this.getInputs(node);
            })
            .then(inputs => {
                var ids = inputs.map(i => this.core.getPath(i[2])),
                    dataNodes;

                dataNodes = Object.keys(this.nodes)
                    .map(id => this.nodes[id])
                    .filter(node => this.isMetaTypeOf(node, this.META.Transporter))
                    .filter(node => 
                        ids.indexOf(this.core.getPointerPath(node, 'dst')) > -1
                    )
                    .map(node => this.core.getPointerPath(node, 'src'))
                    .map(id => this.nodes[id]);

                // get the input node
                if (dataNodes.length === 0) {
                    this.logger.error(`Could not find data to save! ${nodeId}`);
                } else {
                    var newNodes = this.core.copyNodes(dataNodes, parentNode),
                        newName = this.core.getOwnAttribute(node, 'saveName');
                    if (newName) {
                        newNodes.forEach(node =>
                            this.core.setAttribute(node, 'name', newName)
                        );
                    }
                }
                var hashes = dataNodes.map(n => this.core.getAttribute(n, 'data'));
                this.logger.info(`saving hashes: ${hashes.map(h => `"${h}"`)}`);
                this.onOperationComplete(node);
            });

        // Overwrite existing node w/ this name?
        // TODO
    };

    LocalExecutor.TYPES = Object.keys(LocalExecutor.prototype)
        .filter(name => name.indexOf('_') !== 0);
    
    return LocalExecutor;
});
