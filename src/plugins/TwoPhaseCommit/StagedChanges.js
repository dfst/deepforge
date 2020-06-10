/* globals define */
define([
    './CreatedNode',
    'common/util/assert',
], function(
    CreatedNode,
    assert,
) {

    function StagedChanges(createdNodes, changes, deletions, idDict) {
        this.createdNodes = createdNodes;
        this.changes = changes;
        this.deletions = deletions;
        this._createdGMEIds = idDict;
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

    StagedChanges.prototype.resolveCreateIds = function() {
        const changedIds = Object.keys(this.changes)
            .filter(id => CreatedNode.isCreateId(id));

        changedIds.forEach(createId => {
            const gmeId = this.resolveCreateId(createId);
            this.changes[gmeId] = this.changes[createId];
            delete this.changes[createId];
        });

        this.deletions = this.deletions.map(id => {
            if (CreatedNode.isCreateId(id)) {
                return this.resolveCreateId(id);
            }
            return id;
        });
    };

    StagedChanges.prototype.getAllNodeEdits = function() {
        return this.changes;
    };

    StagedChanges.prototype.tryResolveCreateId = function(id) {
        const gmeId = this._createdGMEIds[id];
        return gmeId;
    };

    StagedChanges.prototype.resolveCreateId = function(id) {
        const gmeId = this.tryResolveCreateId(id);
        assert(gmeId, `Creation id not resolved to actual id: ${id}`);

        return gmeId;
    };

    StagedChanges.prototype.getNodeEdits = function(id) {
        id = CreatedNode.isCreateId(id) ? this.resolveCreateId(id) : id;

        return this.changes[id];
    };

    StagedChanges.prototype.tryGetNodeEdits = function(id) {
        id = CreatedNode.isCreateId(id) ? this.tryResolveCreateId(id) : id;
        if (id) {
            return null;
        }

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

    return StagedChanges;
});
