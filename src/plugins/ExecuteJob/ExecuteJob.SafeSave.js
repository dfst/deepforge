/*globals define*/
define([
    'plugin/PluginBase',
    'common/storage/constants',
    'q',
    'common/util/assert'
], function(
    PluginBase,
    STORAGE_CONSTANTS,
    Q,
    assert
) {

    var CREATE_PREFIX = 'created_node_',
        INDEX = 1;

    var ExecuteJob = function() {
        this.forkNameBase = null;
        this.runningJobHashes = [];
        this._currentSave = Q();
    };

    ExecuteJob.prototype.getCreateId = function () {
        return CREATE_PREFIX + (++INDEX);
    };

    ExecuteJob.prototype.isCreateId = function (id) {
        return (typeof id === 'string') && (id.indexOf(CREATE_PREFIX) === 0);
    };

    ExecuteJob.prototype.createNode = function (baseType, parent) {
        var id = this.getCreateId(),
            parentId = this.isCreateId(parent) ? parent : this.core.getPath(parent);

        this.logger.info(`Creating ${id} of type ${baseType} in ${parentId}`);
        assert(this.META[baseType], `Cannot create node w/ unrecognized type: ${baseType}`);
        this.creations[id] = {
            base: baseType,
            parent: parentId
        };
        return id;
    };

    ExecuteJob.prototype.deleteNode = function (nodeId) {
        this.deletions.push(nodeId);
    };

    ExecuteJob.prototype.delAttribute = function (node, attr) {
        return this.setAttribute(node, attr, null);
    };

    ExecuteJob.prototype.setAttribute = function (node, attr, value) {
        var nodeId;

        if (this.isCreateId(node)) {
            nodeId = node;
        } else {
            nodeId = this.core.getPath(node);
            assert(typeof nodeId === 'string', `Cannot set attribute of ${nodeId}`);
        }

        if (value !== null) {
            this.logger.info(`Setting ${attr} of ${nodeId} to ${value}`);
        } else {
            this.logger.info(`Deleting ${attr} of ${nodeId}`);
        }

        if (!this.changes[nodeId]) {
            this.changes[nodeId] = {};
        }
        this.changes[nodeId][attr] = value;
    };

    ExecuteJob.prototype.getAttribute = function (node, attr) {
        var nodeId;

        assert(this.deletions.indexOf(nodeId) === -1,
            `Cannot get ${attr} from deleted node ${nodeId}`);

        // Check if it was newly created
        if (this.isCreateId(node)) {
            nodeId = node;
            assert(this.creations[nodeId], `Creation node not updated: ${nodeId}`);
            node = this.META[this.creations[nodeId].base];
        } else {
            nodeId = this.core.getPath(node);
        }

        // Check the most recent changes, then the currentChanges, then the model
        var value = this._getValueFrom(nodeId, attr, node, this.changes) ||
            this._getValueFrom(nodeId, attr, node, this.currentChanges);

        if (value) {
            return value;
        }

        return this.core.getAttribute(node, attr);
    };

    ExecuteJob.prototype._getValueFrom = function (nodeId, attr, node, changes) {
        var base;
        if (changes[nodeId] && changes[nodeId][attr] !== undefined) {
            // If deleted the attribute, get the default (inherited) value
            if (changes[nodeId][attr] === null) {
                base = this.isCreateId(nodeId) ? node : this.core.getBase(node);
                return this.getAttribute(base, attr);
            }
            return changes[nodeId][attr];
        }
    };

    ExecuteJob.prototype._applyNodeChanges = function (node, changes) {
        var attr,
            value;

        this.logger.info(`About to apply changes for ${this.core.getPath(node)}`);
        for (var i = changes.length; i--;) {
            attr = changes[i][0];
            value = changes[i][1];
            if (value !== null) {
                this.logger.info(`Setting ${attr} to ${value} (${this.core.getPath(node)})`);
                this.core.setAttribute(node, attr, value);
            } else {
                this.core.delAttribute(node, attr);
            }
        }
        return node;
    };

    ExecuteJob.prototype.applyModelChanges = function () {
        return this.applyCreations()
            .then(() => this.applyChanges())
            .then(() => this.applyDeletions());
    };

    ExecuteJob.prototype.applyChanges = function () {
        var nodeIds = Object.keys(this.changes),
            attrs,
            value,
            changes,
            promises = [],
            changesFor = {},
            id,
            promise;

        this.logger.info('Collecting changes to apply in commit');

        for (var i = nodeIds.length; i--;) {
            changes = [];
            attrs = Object.keys(this.changes[nodeIds[i]]);
            for (var a = attrs.length; a--;) {
                value = this.changes[nodeIds[i]][attrs[a]];
                changes.push([attrs[a], value]);
            }
            changesFor[nodeIds[i]] = changes;

            assert(changes, `changes are invalid for ${nodeIds[i]}: ${changes}`);
            assert(!this.isCreateId(nodeIds[i]),
                `Creation id not resolved to actual id: ${nodeIds[i]}`);
            promise = this.core.loadByPath(this.rootNode, nodeIds[i]);
            promises.push(promise);
        }

        this.currentChanges = this.changes;
        this.changes = {};
        // Need to differentiate between read/write changes.
        this.logger.info(`About to apply changes for ${promises.length} nodes`);
        return Q.all(promises)
            .then(nodes => {
                for (var i = nodes.length; i--;) {
                    id = this.core.getPath(nodes[i]);
                    assert(nodes[i], `node is ${nodes[i]} (${nodeIds[i]})`);
                    this._applyNodeChanges(nodes[i], changesFor[id]);
                }

                // Local model is now up-to-date. No longer need currentChanges
                this.currentChanges = {};
            });
    };

    ExecuteJob.prototype.applyCreations = function () {
        var nodeIds = Object.keys(this.creations),
            tiers = this.createCreationTiers(nodeIds),
            creations = this.creations,
            newIds = {},
            promise = Q(),
            tier;

        this.logger.info('Applying node creations');
        for (var i = 0; i < tiers.length; i++) {
            tier = tiers[i];
            // Chain the promises, loading each tier sequentially
            promise = promise.then(this.applyCreationTier.bind(this, creations, newIds, tier));
        }

        this.creations = {};
        return promise;
    };

    ExecuteJob.prototype.applyCreationTier = function (creations, newIds, tier) {
        var promises = [],
            parentId,
            node;

        for (var j = tier.length; j--;) {
            node = creations[tier[j]];
            assert(node, `Could not find create info for ${tier[j]}`);
            parentId = newIds[node.parent] || node.parent;
            promises.push(this.applyCreation(tier[j], node.base, parentId));
        }
        return Q.all(promises).then(nodes => {
            // Record the newIds so they can be used to resolve creation ids
            // in subsequent tiers
            for (var i = tier.length; i--;) {
                newIds[tier[i]] = this.core.getPath(nodes[i]);
            }
        });
    };

    // Figure out the dependencies between nodes to create.
    // eg, if newId1 is to be created in newId2, then newId2 will
    // be in an earlier tier than newId1. Essentially a topo-sort
    // on a tree structure
    ExecuteJob.prototype.createCreationTiers = function (nodeIds) {
        var tiers = [],
            prevTier = {},
            tier = {},
            id,
            prevLen,
            i;

        // Create first tier (created inside existing nodes)
        for (i = nodeIds.length; i--;) {
            id = nodeIds[i];
            if (!this.isCreateId(this.creations[id].parent)) {
                tier[id] = true;
                nodeIds.splice(i, 1);
            }
        }
        prevTier = tier;
        tiers.push(Object.keys(tier));

        // Now, each tier consists of the nodes to be created inside a
        // node from the previous tier
        while (nodeIds.length) {
            prevLen = nodeIds.length;
            tier = {};
            for (i = nodeIds.length; i--;) {
                id = nodeIds[i];
                if (prevTier[this.creations[id].parent]) {
                    tier[id] = true;
                    nodeIds.splice(i, 1);
                }
            }
            prevTier = tier;
            tiers.push(Object.keys(tier));
            // Every iteration should find at least one node
            assert(prevLen > nodeIds.length,
                `Created empty create tier! Remaining: ${nodeIds.join(', ')}`);
        }

        return tiers;
    };

    ExecuteJob.prototype.applyCreation = function (tmpId, baseType, parentId) {
        var base = this.META[baseType],
            nodeId,
            id;

        this.logger.info(`Applying creation of ${tmpId} (${baseType}) in ${parentId}`);

        assert(!this.isCreateId(parentId),
            `Did not resolve parent id: ${parentId} for ${tmpId}`);
        assert(base, `Invalid base type: ${baseType}`);
        return this.core.loadByPath(this.rootNode, parentId)
            .then(parent => this.core.createNode({base, parent}))
            .then(node => {  // Update the _metadata records
                id = this.createIdToMetadataId[tmpId];
                delete this.createIdToMetadataId[tmpId];
                this._metadata[id] = node;

                // Update creations
                nodeId = this.core.getPath(node);
                if (this.changes[tmpId]) {
                    assert(!this.changes[nodeId],
                        `Newly created node cannot already have changes! (${nodeId})`);
                    this.changes[nodeId] = this.changes[tmpId];
                    delete this.changes[tmpId];
                }

                // Update any deletions
                let index = this.deletions.indexOf(tmpId);
                if (index !== -1) {
                    this.deletions.splice(index, 1, nodeId);
                }
                return node;
            });
    };

    ExecuteJob.prototype.applyDeletions = function () {
        var deletions = this.deletions;

        // Remove any creation ids
        this.deletions = [];
        for (let i = deletions.length; i--;) {
            if (this.isCreateId(deletions[i])) {
                this.deletions.push(deletions[i]);
                deletions.splice(i, 1);
            }
        }

        return Q.all(deletions.map(id => this.core.loadByPath(this.rootNode, id)))
            .then(nodes => {
                for (var i = nodes.length; i--;) {
                    this.core.deleteNode(nodes[i]);
                }
            });
    };

    // Override 'save' to notify the user on fork
    ExecuteJob.prototype.save = function (msg) {
        this._currentSave = this._currentSave
            .then(() => this.updateForkName(this.forkNameBase))
            .then(() => this.applyModelChanges())
            .then(() => PluginBase.prototype.save.call(this, msg))
            .then(result => {
                this.logger.info(`Save finished w/ status: ${result.status}`);
                if (result.status === STORAGE_CONSTANTS.FORKED) {
                    return this.onSaveForked(result.forkName);
                } else if (result.status === STORAGE_CONSTANTS.MERGED) {
                    this.logger.debug('Merged changes. About to update plugin nodes');
                    return this.updateNodes();
                }
            });

        return this._currentSave;
    };

    ExecuteJob.prototype.onSaveForked = function (forkName) {
        var name = this.getAttribute(this.activeNode, 'name'),
            msg = `"${name}" execution has forked to "${forkName}"`;
        this.currentForkName = forkName;

        this.logManager.fork(forkName);
        this.runningJobHashes.forEach(jobId => this.originManager.fork(jobId, forkName));
        this.sendNotification(msg);
    };

    ExecuteJob.prototype.updateNodes = function (hash) {
        var activeId = this.core.getPath(this.activeNode);

        hash = hash || this.currentHash;
        return Q.ninvoke(this.project, 'loadObject', hash)
            .then(commitObject => {
                return this.core.loadRoot(commitObject.root);
            })
            .then(rootObject => {
                this.rootNode = rootObject;
                return this.core.loadByPath(rootObject,activeId);
            })
            .then(activeObject => this.activeNode = activeObject)
            .then(() => {
                var metaNames = Object.keys(this.META);

                return Q.all(metaNames.map(name => this.updateMetaNode(name)));
            })
            .then(() => {
                var mdNodes,
                    mdIds;

                mdIds = Object.keys(this._metadata)
                    .filter(id => !this.isCreateId(this._metadata[id]));

                mdNodes = mdIds.map(id => this.core.getPath(this._metadata[id]))
                    .map(nodeId => this.core.loadByPath(this.rootNode, nodeId));

                return Q.all(mdNodes).then(nodes => {
                    for (var i = nodes.length; i--;) {
                        this._metadata[mdIds[i]] = nodes[i];
                    }
                });
            });
    };

    ExecuteJob.prototype.updateMetaNode = function (name) {
        var id = this.core.getPath(this.META[name]);
        return this.core.loadByPath(this.rootNode, id).then(node => this.META[name] = node);
    };

    return ExecuteJob;
});
