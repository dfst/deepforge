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

    const CREATE_PREFIX = 'created_node_';
    const TwoPhaseCommit = function() {
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.forkNameBase = null;
        this._currentSave = Q();

        this.changes = {};
        this.createdNodes = [];
        this.deletions = [];

        this.queuedChangesToCommit = [];
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
        const node = new CreatedNode(this.META[baseType], parent);

        this.logger.info(`Creating ${node.id} of type ${baseType} in ${parentId}`);
        assert(this.META[baseType], `Cannot create node w/ unrecognized type: ${baseType}`);
        this.createdNodes.push(node);
        return node;
    };

    TwoPhaseCommit.prototype.deleteNode = function (node) {
        this.deletions.push(node);
    };

    TwoPhaseCommit.prototype.loadChildren = async function (node) {
        if (isCreatedNode(node)) {
            const parentId = node.id;
            const allCreatedNodes = this.queuedChangesToCommit.concat([this])
                .map(changes => changes.createdNodes)
                .reduce((l1, l2) => l1.concat(l2));

            return allCreatedNodes.filter(node => node.parentId === parentId);
        } else {
            return await this.core.loadChildren(node);
        }
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
        changes.ptr[name] = target;
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
            let [ptr, target] = ptrPairs[i];
            target = await CreatedNode.getGMENode(this.rootNode, this.core, target);
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
        for (let i = changes.createdNodes.length; i--;) {
            const createdNode = changes.createdNodes[i];
            const node = await createdNode.toGMENode(this.rootNode, this.core);
            changes.onNodeCreated(createdNode, this.core.getPath(node));
            this.onNodeCreated(createdNode, node);
        }
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

    TwoPhaseCommit.prototype.onNodeCreated = async function (/*tmpId, node*/) {
    };

    TwoPhaseCommit.prototype.applyDeletions = async function (changes) {
        const nodes = await changes.getDeletedNodes(this.rootNode, this.core);

        for (let i = nodes.length; i--;) {
            this.core.deleteNode(nodes[i]);
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
    };

    TwoPhaseCommit.prototype.getNodeCaches = function () {
        return [this.META];
    };

    /**
     * Update a dictionary of *existing* nodes to the node instances in the
     * current commit.
     */
    TwoPhaseCommit.prototype.updateExistingNodeDict = async function (dict, keys) {
        keys = keys || Object.keys(dict);

        for (let i = keys.length; i--;) {
            const key = keys[i];
            const oldNode = isCreatedNode(dict[key]) ?
                await dict[key].toGMENode(this.rootNode, this.core) : dict[key];

            const nodePath = this.core.getPath(oldNode);
            dict[key] = await this.core.loadByPath(this.rootNode, nodePath);
        }
    };

    function StagedChanges(createdNodes, changes, deletions) {
        this.createdNodes = createdNodes;
        this.changes = changes;
        this.deletions = deletions;
    }

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

    StagedChanges.prototype.getDeletedNodes = function(root, core) {
        const gmeNodes = this.deletions
            .map(node => CreatedNode.getGMENode(root, core, node));

        return Promise.all(gmeNodes);
    };

    let counter = 0;
    function CreatedNode(base, parent) {
        this.id = CREATE_PREFIX + (++counter);
        this.base = base;
        this.parent = parent;
        this._nodeId = null;
    }

    CreatedNode.getGMENode = async function(rootNode, core, node) {
        return !isCreatedNode(node) ?
            await core.loadByPath(rootNode, core.getPath(node)) :
            await node.toGMENode(rootNode, core);
    };

    CreatedNode.prototype.toGMENode = async function(rootNode, core) {
        if (!this._nodeId) {
            const parent = await CreatedNode.getGMENode(rootNode, core, this.parent);
            const base = await CreatedNode.getGMENode(rootNode, core, this.base);
            const node = core.createNode({base, parent});
            this._nodeId = core.getPath(node);
            return node;
        }
        return core.loadByPath(rootNode, this._nodeId);
    };

    return TwoPhaseCommit;
});
