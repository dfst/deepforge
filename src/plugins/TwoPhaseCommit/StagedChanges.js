/* globals define */
define([
    './CreatedNode',
    'common/util/assert',
], function(
    CreatedNode,
    assert,
) {

    function StagedChanges(idDict, predecessor) {
        assert(idDict);
        this.createdNodes = [];
        this.changes = {};
        this.deletions = [];
        this._createdGMEIds = idDict;
        this.predecessor = predecessor;
    }

    StagedChanges.prototype.getCreatedNode = function(id) {
        return this.createdNodes.find(node => node.id === id);
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
        const ids = [id];
        if (CreatedNode.isCreateId(id) && this.tryResolveCreateId(id)) {
            ids.push(this.tryResolveCreateId(id));
        }
        return ids
            .map(id => this.changes[id])
            .find(changes => changes) || null;
    };

    StagedChanges.prototype.getModifiedNodeIds = function() {
        return Object.keys(this.changes);
    };

    StagedChanges.prototype.getDeletedNodes = function(root, core) {
        const gmeNodes = this.deletions
            .map(node => CreatedNode.getGMENode(root, core, node));

        return Promise.all(gmeNodes);
    };

    StagedChanges.prototype.getChangesForNode = function (nodeId) {
        if (!this.changes[nodeId]) {
            this.changes[nodeId] = {
                attr: {},
                ptr: {},
            };
        }

        return this.changes[nodeId];
    };

    StagedChanges.prototype.next = function() {
        return new StagedChanges(this._createdGMEIds, this);
    };

    StagedChanges.prototype.changesets = function() {
        if (this.predecessor) {
            return this.predecessor.changesets().concat([this]);
        }
        return [this];
    };

    return StagedChanges;
});
