/* globals define */
define([
], function(
) {
    let counter = 0;
    class CreatedNode {
        constructor(base, parent) {
            this.id = CreatedNode.CREATE_PREFIX + (++counter);
            this.base = base;
            this.parent = parent;
            this._nodeId = null;
        }

        static async getGMENode (rootNode, core, node) {
            return !(node instanceof CreatedNode) ?
                await core.loadByPath(rootNode, core.getPath(node)) :
                await node.toGMENode(rootNode, core);
        }

        async toGMENode (rootNode, core) {
            if (!this._nodeId) {
                const parent = await CreatedNode.getGMENode(rootNode, core, this.parent);
                const base = await CreatedNode.getGMENode(rootNode, core, this.base);
                const node = core.createNode({base, parent});
                this._nodeId = core.getPath(node);
                return node;
            }
            return core.loadByPath(rootNode, this._nodeId);
        }

        async getInheritedChildren (core) {
            if (this.base instanceof CreatedNode) {
                return this.base.getInheritedChildren(core);
            } else {
                return (await core.loadChildren(this.base))
                    .map(node => new InheritedNode(node, this));
            }
        }

        static isCreateId (id) {
            return (typeof id === 'string') && (id.indexOf(CreatedNode.CREATE_PREFIX) === 0);
        }
    }
    CreatedNode.CREATE_PREFIX = 'created_node_';

    class InheritedNode extends CreatedNode {
        async toGMENode (rootNode, core) {
            if (!this._nodeId) {
                const parent = await CreatedNode.getGMENode(rootNode, core, this.parent);
                const base = await CreatedNode.getGMENode(rootNode, core, this.base);
                const children = await core.loadChildren(parent);
                const basePath = core.getPath(base);
                const node = children
                    .find(node => core.getPath(core.getBase(node)) === basePath);

                this._nodeId = core.getPath(node);
                return node;
            }
            return core.loadByPath(rootNode, this._nodeId);
        }
    }

    class CopiedNode extends CreatedNode {
        constructor(original, parent) {
            super(original, parent);
            this.parent = parent;
            this.original = original;
        }

        async toGMENode (rootNode, core) {
            if (!this._nodeId) {
                const parent = await CreatedNode.getGMENode(rootNode, core, this.parent);
                const original = await CreatedNode.getGMENode(rootNode, core, this.original);
                const node = core.copyNode(original, parent);
                this._nodeId = core.getPath(node);
                return node;
            }
            return core.loadByPath(rootNode, this._nodeId);
        }

        async getInheritedChildren (/*core*/) {
            throw new Error('Cannot get children of copied node');
        }
    }

    CreatedNode.CopiedNode = CopiedNode;
    return CreatedNode;
});
