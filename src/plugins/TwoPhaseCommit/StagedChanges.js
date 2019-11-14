/* globals define */
define([
    './CreatedNode',
    'common/util/assert',
], function(
    CreatedNode,
    assert,
) {

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
        assert(!CreatedNode.isCreateId(id),
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

    return StagedChanges;
});
