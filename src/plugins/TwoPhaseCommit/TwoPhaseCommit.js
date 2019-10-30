/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/PluginBase',
    'common/storage/constants',
    'q',
    'common/util/assert',
    'text!./metadata.json',
], function(
    PluginBase,
    STORAGE_CONSTANTS,
    Q,
    assert,
    pluginMetadata,
) {

    pluginMetadata = JSON.parse(pluginMetadata);

    var CREATE_PREFIX = 'created_node_',
        INDEX = 1;

    const TwoPhaseCommit = function() {
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.forkNameBase = null;
        this._currentSave = Q();

        this.changes = {};
        this.createdNodes = [];
        this.deletions = [];

        this.queuedChangesToCommit = [];

        this._metadata = {};
        this.createIdToMetadataId = {};  // TODO: REMOVE
        
    };

    TwoPhaseCommit.INVOKE_ERR = 'TwoPhaseCommit is an abstract plugin and not meant for direct usage.';
    TwoPhaseCommit.metadata = pluginMetadata;
    TwoPhaseCommit.prototype = Object.create(PluginBase.prototype);
    TwoPhaseCommit.prototype.constructor = TwoPhaseCommit;

    TwoPhaseCommit.prototype.main = function (/*callback*/) {
        throw new Error(TwoPhaseCommit.INVOKE_ERR);
    };

    TwoPhaseCommit.prototype.getCreateId = function () {
    };

    const isCreatedNode = function (node) {
        return node instanceof CreatedNode;
    };

    const isCreateId = function (id) {
        return (typeof id === 'string') && (id.indexOf(CREATE_PREFIX) === 0);
    };

    TwoPhaseCommit.prototype.createNode = function (baseType, parent) {
        const parentId = parent instanceof CreatedNode ? parent.id : this.core.getPath(parent);
        const node = new CreatedNode(baseType, parentId);

        this.logger.info(`Creating ${node.id} of type ${baseType} in ${parentId}`);
        assert(this.META[baseType], `Cannot create node w/ unrecognized type: ${baseType}`);
        this.createdNodes.push(node);
        return node;
    };

    TwoPhaseCommit.prototype.deleteNode = function (node) {
        const nodeId = isCreatedNode(node) ? node.id : this.core.getPath(node);
        this.deletions.push(nodeId);
    };

    TwoPhaseCommit.prototype.delAttribute = function (node, attr) {
        return this.setAttribute(node, attr, null);
    };

    TwoPhaseCommit.prototype.setAttribute = function (node, attr, value) {
        if (value === undefined) {
            throw new Error(`Cannot set attribute to undefined value (${attr})`);
        }

        this.logger.warn(`setting ${attr} to ${value}`);
        const changes = this.getChangesForNode(node);
        changes.attr[attr] = value;
    };

    TwoPhaseCommit.prototype.getAttribute = function (node, attr) {
        var nodeId;

        // Check if it was newly created
        if (isCreatedNode(node)) {
            nodeId = node.id;
            node = this.META[node.baseType];
        } else {
            nodeId = this.core.getPath(node);
        }

        assert(this.deletions.indexOf(nodeId) === -1,
            `Cannot get ${attr} from deleted node ${nodeId}`);

        // Check the most recent changes, then the staged changes, then the model
        let value = this._getValueFrom(nodeId, attr, node, this.changes);

        if (value === undefined) {
            for (let i = this.queuedChangesToCommit.length; i--;) {
                const changes = this.queuedChangesToCommit[i];
                value = this._getValueFrom(nodeId, attr, node, changes.getAllNodeEdits());
                if (value !== undefined) {
                    return value;
                }
            }
        }

        if (value !== undefined) {
            return value;
        }

        return this.core.getAttribute(node, attr);
    };

    TwoPhaseCommit.prototype.getChangesForNode = function (node) {
        var nodeId;

        if (isCreatedNode(node)) {
            nodeId = node.id;
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

    TwoPhaseCommit.prototype.setPointer = function (node, name, target) {
        const changes = this.getChangesForNode(node);
        const targetId = isCreatedNode(target) ? target.id : this.core.getPath(target);
        changes.ptr[name] = targetId;
    };

    TwoPhaseCommit.prototype._getValueFrom = function (nodeId, attr, node, changes) {
        var base;
        if (changes[nodeId] && changes[nodeId].attr[attr] !== undefined) {
            // If deleted the attribute, get the default (inherited) value
            if (changes[nodeId].attr[attr] === null) {
                base = isCreateId(nodeId) ? node : this.core.getBase(node);
                let inherited = this.getAttribute(base, attr);
                return inherited || null;
            }
            return changes[nodeId].attr[attr];
        }
    };

    TwoPhaseCommit.prototype._applyNodeChanges = async function (node, edits) {
        const attrPairs = Object.entries(edits.attr);

        this.logger.info(`About to apply edits for ${this.core.getPath(node)}`);
        for (let i = attrPairs.length; i--;) {
            const [attr, value] = attrPairs[i];
            if (value !== null) {
                this.logger.info(`Setting ${attr} to ${value} (${this.core.getPath(node)})`);
                this.core.setAttribute(node, attr, value);
            } else {
                this.core.delAttribute(node, attr);
            }
        }

        const ptrPairs = Object.entries(edits.ptr);
        for (let i = ptrPairs.length; i--;) {
            const [ptr, targetId] = ptrPairs[i];
            const target = await this.core.loadByPath(this.rootNode, targetId);
            this.core.setPointer(node, ptr, target);
        }

        return node;
    };

    TwoPhaseCommit.prototype.getStagedChanges = function () {
        const changes = new StagedChanges(this.createdNodes, this.changes, this.deletions);
        this.createdNodes = [];
        this.changes = {};
        this.deletions = [];
        return changes;
    };

    TwoPhaseCommit.prototype.applyModelChanges = async function (changes) {
        await this.applyCreations(changes);
        await this.applyChanges(changes);
        await this.applyDeletions(changes);
    };

    TwoPhaseCommit.prototype.applyChanges = async function (changes) {
        const nodeIds = changes.getModifiedNodeIds();

        this.logger.info('Collecting changes to apply in commit');

        this.currentChanges = this.changes;
        for (let i = nodeIds.length; i--;) {
            const id = nodeIds[i];
            const edits = changes.getNodeEdits(id);

            const node = await this.core.loadByPath(this.rootNode, id);
            assert(node, `node is ${node} (${id})`);
            await this._applyNodeChanges(node, edits);
        }
        this.currentChanges = {};
    };

    TwoPhaseCommit.prototype.applyCreations = async function (changes) {
        const tiers = changes.createCreationTiers();
        const newNodes = {};

        this.logger.info('Applying staged changes: node creations');
        for (let i = 0; i < tiers.length; i++) {
            const tier = tiers[i];
            await this.applyCreationTier(changes, newNodes, tier);
        }

        return await this.resolveCreatedPtrTargets(newNodes);
    };

    TwoPhaseCommit.prototype.resolveCreatedPtrTargets = function (newNodes) {
        const ids = Object.keys(this.changes);
        ids.forEach(srcId => {
            const ptrPairs = Object.entries(this.changes[srcId].ptr);
            ptrPairs.forEach(pair => {
                const [ptr, target] = pair;

                if (isCreateId(target) && newNodes[target]) {
                    this.changes[srcId].ptr[ptr] = newNodes[target];
                }
            });
        });
    };

    TwoPhaseCommit.prototype.applyCreationTier = async function (changes, newNodes, tier) {
        for (let j = tier.length; j--;) {
            const tmpId = tier[j];
            const createdNode = changes.getCreatedNode(tmpId);
            const node = await this.applyCreateNode(createdNode);
            changes.onNodeCreated(createdNode, this.core.getPath(node));
            this.onNodeCreated(createdNode, node);
            newNodes[tmpId] = node;
        }
    };

    TwoPhaseCommit.prototype.onNodeCreated = async function (/*tmpId, node*/) {
    };

    TwoPhaseCommit.prototype.applyCreateNode = async function (createdNode) {
        const {id, baseType, parentId} = createdNode;
        const base = this.META[baseType];

        this.logger.info(`Applying creation of ${id} (${baseType}) in ${parentId}`);

        assert(!isCreateId(parentId),
            `Did not resolve parent id: ${parentId} for ${id}`);
        assert(base, `Invalid base type: ${baseType}`);
        const parent = await this.core.loadByPath(this.rootNode, parentId);
        const node = await this.core.createNode({base, parent});
        return node;
    };

    TwoPhaseCommit.prototype.applyDeletions = async function (changes) {
        const deletedIds = changes.getDeletedNodeIds();

        for (let i = deletedIds.length; i--;) {
            const id = deletedIds[i];
            if (isCreateId(id)) {
                continue;
            }
            const node = await this.core.loadByPath(this.rootNode, id);
            this.core.deleteNode(node);
        }
    };

    TwoPhaseCommit.prototype.updateForkName = async function (basename) {
        basename = basename + '_fork';
        basename = basename.replace(/[- ]/g, '_');
        const branches = await this.project.getBranches();
        const names = Object.keys(branches);
        let name = basename,
            i = 2;

        while (names.indexOf(name) !== -1) {
            name = basename + '_' + i;
            i++;
        }

        this.forkName = name;
    };

    // Override 'save' to notify the user on fork
    TwoPhaseCommit.prototype.save = async function (msg) {
        const changes = this.getStagedChanges();
        this.queuedChangesToCommit.push(changes);
        this._currentSave = this._currentSave
            .then(() => this.updateForkName(this.forkNameBase))
            .then(() => this.applyModelChanges(changes))
            .then(() => PluginBase.prototype.save.call(this, msg))
            .then(result => {
                assert(this.queuedChangesToCommit[0] === changes);
                this.queuedChangesToCommit.shift();

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

    TwoPhaseCommit.prototype.onSaveForked = function (forkName) {
        var name = this.getAttribute(this.activeNode, 'name'),
            msg = `"${name}" execution has forked to "${forkName}"`;

        this.currentForkName = forkName;
        this.sendNotification(msg);
    };

    TwoPhaseCommit.prototype.updateNodes = async function (hash) {
        const activeId = this.core.getPath(this.activeNode);

        hash = hash || this.currentHash;
        const commitObject = await Q.ninvoke(this.project, 'loadObject', hash);
        this.rootNode = await this.core.loadRoot(commitObject.root);
        this.activeNode = await this.core.loadByPath(this.rootNode, activeId);

        const caches = this.getNodeCaches();
        for (let i = caches.length; i--;) {
            await this.updateExistingNodeDict(caches[i]);
        }

        const existingIds = Object.keys(this._metadata)
            .filter(id => !isCreateId(this._metadata[id]));

        await this.updateExistingNodeDict(this._metadata, existingIds);
    };

    TwoPhaseCommit.prototype.getNodeCaches = function () {
        return [this.META];
    };

    /**
     * Update a dictionary of *existing* nodes to the node instances in the
     * current commit.
     */
    TwoPhaseCommit.prototype.updateExistingNodeDict = function (dict, keys) {
        keys = keys || Object.keys(dict);

        return Q.all(keys.map(key => {
            const oldNode = dict[key];
            const nodePath = this.core.getPath(oldNode);
            return this.core.loadByPath(this.rootNode, nodePath)
                .then(newNode => dict[key] = newNode);
        }));
    };

    function StagedChanges(createdNodes, changes, deletions) {
        this.createdNodes = createdNodes;
        this.changes = changes;
        this.deletions = deletions;
    }

    // Figure out the dependencies between nodes to create.
    // eg, if newId1 is to be created in newId2, then newId2 will
    // be in an earlier tier than newId1. Essentially a topo-sort
    // on a tree structure
    StagedChanges.prototype.createCreationTiers = function () {
        const nodes = this.createdNodes.slice();
        var tiers = [],
            prevTier = {},
            tier = {},
            id,
            prevLen,
            i;

        // Create first tier (created inside existing nodes)
        for (i = nodes.length; i--;) {
            id = nodes[i].id;
            if (!isCreateId(nodes[i].parentId)) {
                tier[id] = true;
                nodes.splice(i, 1);
            }
        }
        prevTier = tier;
        tiers.push(Object.keys(tier));

        // Now, each tier consists of the nodes to be created inside a
        // node from the previous tier
        while (nodes.length) {
            prevLen = nodes.length;
            tier = {};
            for (i = nodes.length; i--;) {
                id = nodes[i].id;
                if (prevTier[nodes[i].parentId]) {
                    tier[id] = true;
                    nodes.splice(i, 1);
                }
            }
            prevTier = tier;
            tiers.push(Object.keys(tier));
            // Every iteration should find at least one node
            assert(prevLen > nodes.length,
                `Created empty create tier! Remaining: ${nodes.length}`);
        }

        return tiers;
    };

    StagedChanges.prototype.getCreatedNode = function(id) {
        return this.createdNodes.find(node => node.id === id);
    };

    StagedChanges.prototype.onNodeCreated = function(createdNode, nodeId) {
        // Update newly created node
        const tmpId = createdNode.id;
        if (this.changes[tmpId]) {
            assert(!this.changes[nodeId],
                `Newly created node cannot already have changes! (${nodeId})`);
            this.changes[nodeId] = this.changes[tmpId];

            delete this.changes[tmpId];
        }

        this.createdNodes.forEach(node => {
            if (node.parentId === tmpId) {
                node.parentId = nodeId;
            }
        });

        // Update any deletions
        let index = this.deletions.indexOf(tmpId);
        if (index !== -1) {
            this.deletions.splice(index, 1, nodeId);
        }
    };

    StagedChanges.prototype.getAllNodeEdits = function() {
        return this.changes;
    };

    StagedChanges.prototype.getNodeEdits = function(id) {
        assert(!isCreateId(id),
            `Creation id not resolved to actual id: ${id}`);

        return this.changes[id];
    };

    StagedChanges.prototype.getModifiedNodeIds = function() {
        return Object.keys(this.changes);
    };

    StagedChanges.prototype.getDeletedNodeIds = function() {
        return this.deletions;
    };

    function CreatedNode(baseType, parentId) {
        this.id = CREATE_PREFIX + (++INDEX);
        this.baseType = baseType;
        this.parentId = parentId;
    }

    return TwoPhaseCommit;
});
