/* globals define */
define([
], function(
) {
    CreatedNode.CREATE_PREFIX = 'created_node_';
    let counter = 0;
    function CreatedNode(base, parent) {
        this.id = CreatedNode.CREATE_PREFIX + (++counter);
        this.base = base;
        this.parent = parent;
        this._nodeId = null;
    }

    CreatedNode.getGMENode = async function(rootNode, core, node) {
        return !(node instanceof CreatedNode) ?
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

    CreatedNode.isCreateId = function (id) {
        return (typeof id === 'string') && (id.indexOf(CreatedNode.CREATE_PREFIX) === 0);
    };

    return CreatedNode;
});
