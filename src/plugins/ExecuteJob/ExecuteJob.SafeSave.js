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
        if (value === undefined) {
            throw new Error(`Cannot set attributes to undefined (${attr})`);
        }

        this.logger.warn(`setting ${attr} to ${value}`);
        const changes = this.getChangesForNode(node);
        changes.attr[attr] = value;
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
        let value = this._getValueFrom(nodeId, attr, node, this.changes);

        if (value === undefined) {
            value = this._getValueFrom(nodeId, attr, node, this.currentChanges);
        }

        if (value !== undefined) {
            return value;
        }

        return this.core.getAttribute(node, attr);
    };

    ExecuteJob.prototype.getChangesForNode = function (node) {
        var nodeId;

        if (this.isCreateId(node)) {
            nodeId = node;
        } else {
            nodeId = this.core.getPath(node);
            assert(typeof nodeId === 'string', `Cannot set attribute of ${nodeId}`);
        }

        if (!this.changes[nodeId]) {
            this.changes[nodeId] = {
                attr: {},
                ptr: {},
            };
        }

        return this.changes[nodeId];
    };

    ExecuteJob.prototype.setPointer = function (node, name, target) {
        const changes = this.getChangesForNode(node);
        changes.ptr[name] = target;
    };

    ExecuteJob.prototype._getValueFrom = function (nodeId, attr, node, changes) {
        var base;
        if (changes[nodeId] && changes[nodeId].attr[attr] !== undefined) {
            // If deleted the attribute, get the default (inherited) value
            if (changes[nodeId].attr[attr] === null) {
                base = this.isCreateId(nodeId) ? node : this.core.getBase(node);
                let inherited = this.getAttribute(base, attr);
                return inherited || null;
            }
            return changes[nodeId].attr[attr];
        }
    };

    ExecuteJob.prototype._applyNodeChanges = function (node, changes) {
        // attributes
        const attrPairs = Object.entries(changes.attr);

        this.logger.info(`About to apply changes for ${this.core.getPath(node)}`);
        for (let i = attrPairs.length; i--;) {
            const [attr, value] = attrPairs[i];
            if (value !== null) {
                this.logger.info(`Setting ${attr} to ${value} (${this.core.getPath(node)})`);
                this.core.setAttribute(node, attr, value);
            } else {
                this.core.delAttribute(node, attr);
            }
        }

        const ptrPairs = Object.entries(changes.ptr);
        for (let i = ptrPairs.length; i--;) {
            const [ptr, target] = ptrPairs[i];
            this.core.setPointer(node, ptr, target);
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
            promises = [],
            changesFor = {},
            id,
            promise;

        this.logger.info('Collecting changes to apply in commit');

        for (var i = nodeIds.length; i--;) {
            changesFor[nodeIds[i]] = this.changes[nodeIds[i]];

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
            newNodes = {},
            promise = Q(),
            tier;

        this.logger.info('Applying node creations');
        for (var i = 0; i < tiers.length; i++) {
            tier = tiers[i];
            // Chain the promises, loading each tier sequentially
            promise = promise.then(this.applyCreationTier.bind(this, creations, newNodes, tier));
        }

        this.creations = {};
        return promise
            .then(() => this.resolveCreatedPtrTargets(newNodes));
    };

    ExecuteJob.prototype.resolveCreatedPtrTargets = function (newNodes) {
        const ids = Object.keys(this.changes);
        ids.forEach(srcId => {
            const ptrPairs = Object.entries(this.changes[srcId].ptr);
            ptrPairs.forEach(pair => {
                const [ptr, target] = pair;

                if (this.isCreateId(target) && newNodes[target]) {
                    this.changes[srcId].ptr[ptr] = newNodes[target];
                }
            });
        });
    };

    ExecuteJob.prototype.applyCreationTier = function (creations, newNodes, tier) {
        var promises = [],
            parentId,
            node;

        for (var j = tier.length; j--;) {
            node = creations[tier[j]];
            assert(node, `Could not find create info for ${tier[j]}`);
            if (newNodes[node.parent]) {
                parentId = this.core.getPath(newNodes[node.parent]);
            } else {
                parentId = node.parent;
            }
            promises.push(this.applyCreation(tier[j], node.base, parentId));
        }
        return Q.all(promises).then(nodes => {
            // Record the new nodes so they can be used to resolve creation ids
            // in subsequent tiers
            for (var i = tier.length; i--;) {
                newNodes[tier[i]] = nodes[i];
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

    ExecuteJob.prototype.applyDeletions = async function () {
        var deletions = this.deletions;

        // Remove any creation ids
        this.deletions = [];
        for (let i = deletions.length; i--;) {
            if (this.isCreateId(deletions[i])) {
                this.deletions.push(deletions[i]);
                deletions.splice(i, 1);
            }
        }

        const nodes = await Q.all(deletions.map(id => this.core.loadByPath(this.rootNode, id)));

        for (var i = nodes.length; i--;) {
            this.core.deleteNode(nodes[i]);
        }
    };

    ExecuteJob.prototype.updateForkName = function (basename) {
        basename = basename + '_fork';
        basename = basename.replace(/[- ]/g, '_');
        return this.project.getBranches().then(branches => {
            var names = Object.keys(branches),
                name = basename,
                i = 2;

            while (names.indexOf(name) !== -1) {
                name = basename + '_' + i;
                i++;
            }

            this.forkName = name;
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
                } else if (result.status === STORAGE_CONSTANTS.MERGED ||
                    result.status === STORAGE_CONSTANTS.SYNCED) {
                    this.logger.debug('Applied changes successfully. About to update plugin nodes');
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

    //ExecuteJob.prototype.registerExistingNodeDict = function (hash) {
    ExecuteJob.prototype.updateNodes = async function (hash) {
        const activeId = this.core.getPath(this.activeNode);

        hash = hash || this.currentHash;
        const commitObject = await Q.ninvoke(this.project, 'loadObject', hash);
        this.rootNode = await this.core.loadRoot(commitObject.root);
        this.activeNode = await this.core.loadByPath(this.rootNode, activeId);

        await this.updateExistingNodeDict(this.META);
        await this.updateExistingNodeDict(this._execHashToJobNode);

        const existingIds = Object.keys(this._metadata)
            .filter(id => !this.isCreateId(this._metadata[id]));

        await this.updateExistingNodeDict(this._metadata, existingIds);
    };

    /**
     * Update a dictionary of *existing* nodes to the node instances in the
     * current commit.
     */
    ExecuteJob.prototype.updateExistingNodeDict = function (dict, keys) {
        keys = keys || Object.keys(dict);

        return Q.all(keys.map(key => {
            const oldNode = dict[key];
            const nodePath = this.core.getPath(oldNode);
            return this.core.loadByPath(this.rootNode, nodePath)
                .then(newNode => dict[key] = newNode);
        }));
    };

    return ExecuteJob;
});
