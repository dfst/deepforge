/* globals define */
define([
    './StagedChanges',
    './CreatedNode',
    'common/util/assert',
], function(
    StagedChanges,
    CreatedNode,
    assert,
) {
    function TwoPhaseCore(logger, core) {
        this.logger = logger;
        this.core = core;
        this.changes = {};
        this.createdNodes = [];
        this.deletions = [];
        this.queuedChanges = [];
        this._events = {};
        this._createdGMEIds = {};
    }

    TwoPhaseCore.prototype.unwrap = function () {
        return this.core;
    };

    TwoPhaseCore.prototype.getPath = function (node) {
        return node instanceof CreatedNode ? node.id : this.core.getPath(node);
    };

    passToCore('persist');
    passToCore('loadRoot');
    passToCore('loadByPath');
    passToCore('loadSubTree');
    passToCore('getPointerPath');
    passToCore('getParent');
    passToCore('getNamespace');
    passToCore('getMetaType');
    passToCore('getChildrenMeta');
    passToCore('getChildrenPaths');
    passToCore('addMember');
    passToCore('isMetaNode');
    passToCore('getOwnRegistry');
    passToCore('getOwnAttribute');

    TwoPhaseCore.prototype.getBase = function (node) {
        if (node instanceof CreatedNode) {
            return node.base;
        }
        return this.core.getBase(node);
    };

    TwoPhaseCore.prototype.isTypeOf = function (node, base) {
        if (node instanceof CreatedNode) {
            return this.core.isTypeOf(node.base, base);
        }
        return this.core.isTypeOf(node, base);
    };

    TwoPhaseCore.prototype.getStagedChanges = function () {
        const changes = new StagedChanges(
            this.createdNodes,
            this.changes,
            this.deletions,
            this._createdGMEIds
        );
        this.createdNodes = [];
        this.changes = {};
        this.deletions = [];
        this.queuedChanges.push(changes);
        return changes;
    };

    TwoPhaseCore.prototype.discard = function (changes) {
        const index = this.queuedChanges.indexOf(changes);
        assert(index === 0, 'Expected staged changes to be at front of queue.');
        this.queuedChanges.splice(index, 1);
    };

    TwoPhaseCore.prototype.setPointer = function (node, name, target) {
        const changes = this.getChangesForNode(node);
        changes.ptr[name] = target;
    };

    TwoPhaseCore.prototype.getChangesForNode = function (node) {
        const nodeId = this.getPath(node);

        if (!this.changes[nodeId]) {
            this.changes[nodeId] = {
                attr: {},
                ptr: {},
            };
        }

        return this.changes[nodeId];
    };

    TwoPhaseCore.prototype.createNode = function (desc) {
        const {parent, base} = desc;
        assert(parent, 'Cannot create node without parent');
        assert(base, 'Cannot create node without base');

        const parentId = this.getPath(parent);
        const node = new CreatedNode(base, parent);

        this.logger.info(`Creating ${node.id} in ${parentId}`);
        this.createdNodes.push(node);
        return node;
    };

    TwoPhaseCore.prototype.deleteNode = function (node) {
        this.deletions.push(node);
    };

    TwoPhaseCore.prototype.loadChildren = async function (node) {
        const getId = node => node instanceof CreatedNode ? node.id : this.core.getPath(node);
        const nodeId = getId(node);

        const allCreatedNodes = this.queuedChanges.concat([this])
            .map(changes => changes.createdNodes)
            .reduce((l1, l2) => l1.concat(l2));

        let children = allCreatedNodes.filter(node => getId(node.parent) === nodeId);
        if (!(node instanceof CreatedNode)) {
            children = children.concat(await this.core.loadChildren(node));
        }
        return children;
    };

    TwoPhaseCore.prototype.delAttribute = function (node, attr) {
        return this.setAttribute(node, attr, null);
    };

    TwoPhaseCore.prototype.setAttribute = function (node, attr, value) {
        assert(
            value !== undefined,
            `Cannot set attribute to undefined value (${attr})`
        );

        this.logger.info(`setting ${attr} to ${value}`);
        const changes = this.getChangesForNode(node);
        changes.attr[attr] = value;
    };

    TwoPhaseCore.prototype.getAttribute = function (node, attr) {
        var nodeId;

        // Check if it was newly created
        if (node instanceof CreatedNode) {
            nodeId = node._nodeId || node.id;
            node = node.base;
        } else {
            nodeId = this.core.getPath(node);
        }

        assert(this.deletions.indexOf(nodeId) === -1,
            `Cannot get ${attr} from deleted node ${nodeId}`);

        // Check the most recent changes, then the staged changes, then the model
        let value = this._getValueFrom(nodeId, attr, node, this.changes);

        if (value === undefined) {
            for (let i = this.queuedChanges.length; i--;) {
                const changes = this.queuedChanges[i];
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

    TwoPhaseCore.prototype._getValueFrom = function (nodeId, attr, node, changes) {
        var base;
        if (changes[nodeId] && changes[nodeId].attr[attr] !== undefined) {
            // If deleted the attribute, get the default (inherited) value
            if (changes[nodeId].attr[attr] === null) {
                base = CreatedNode.isCreateId(nodeId) ? node : this.core.getBase(node);
                let inherited = this.getAttribute(base, attr);
                return inherited || null;
            }
            return changes[nodeId].attr[attr];
        }
    };

    TwoPhaseCore.prototype.apply = async function (rootNode, changes) {
        await this.applyCreations(rootNode, changes);
        await this.applyChanges(rootNode, changes);
        await this.applyDeletions(rootNode, changes);
    };

    TwoPhaseCore.prototype.applyCreations = async function (rootNode, changes) {
        for (let i = changes.createdNodes.length; i--;) {
            const createdNode = changes.createdNodes[i];
            const node = await createdNode.toGMENode(rootNode, this.core);
            const nodeId = this.core.getPath(node);
            //changes.onNodeCreated(createdNode, nodeId);
            this.emit('nodeCreated', createdNode, node);
            this._createdGMEIds[createdNode.id] = nodeId;
        }
        changes.resolveCreateIds();
    };

    TwoPhaseCore.prototype.on = function(ev, cb) {
        this._events[ev] = this._events[ev] || [];
        this._events[ev].push(cb);
    };

    TwoPhaseCore.prototype.emit = function(ev) {
        const args = Array.prototype.slice.call(arguments, 1);
        const handlers = this._events[ev] || [];
        handlers.forEach(fn => fn.apply(this, args));
    };

    TwoPhaseCore.prototype.applyChanges = async function (rootNode,changes) {
        const nodeIds = changes.getModifiedNodeIds();

        this.logger.info('Collecting changes to apply in commit');

        this.currentChanges = this.changes;
        for (let i = nodeIds.length; i--;) {
            const id = nodeIds[i];
            const edits = changes.getNodeEdits(id);

            const node = await this.core.loadByPath(rootNode, id);
            assert(node, `node is ${node} (${id})`);
            await this._applyNodeChanges(rootNode, node, edits);
        }
        this.currentChanges = {};
    };

    TwoPhaseCore.prototype._applyNodeChanges = async function (rootNode, node, edits) {
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
            target = await CreatedNode.getGMENode(rootNode, this.core, target);
            this.core.setPointer(node, ptr, target);
        }

        return node;
    };

    TwoPhaseCore.prototype.applyDeletions = async function (rootNode, changes) {
        const nodes = await changes.getDeletedNodes(rootNode, this.core);

        for (let i = nodes.length; i--;) {
            this.core.deleteNode(nodes[i]);
        }
    };

    function passToCore(name) {
        TwoPhaseCore.prototype[name] = function() {
            return this.core[name].apply(this.core, arguments);
        };
    }

    return TwoPhaseCore;
});
