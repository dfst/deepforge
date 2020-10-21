/*globals define*/
define([
    'underscore',
], function(
    _,
) {
    class ExecutionHelpers {
        constructor(core, rootNode) {
            this.core = core;
            this.rootNode = rootNode;
        }

        async snapshotOperation(node, dst, base) {
            // If we are making a snapshot, we should copy the base operation
            // and set the attributes, add the child nodes, etc
            if (!base) {
                base = this.core.getBase(node);
            }
            const snapshot = this.core.createNode({
                base: base,
                parent: dst
            });

            const names = this.core.getAttributeNames(node);
            const values = names.map(name => this.core.getAttribute(node, name));
            names.forEach((name, i) =>
                this.core.setAttribute(snapshot, name, values[i]));

            const ptrNames = this.core.getValidPointerNames(node)
                .filter(name => name !== 'base');
            const setPointers = Promise.all(
                ptrNames.map(async name => {
                    const targetPath = this.core.getPointerPath(node, name);
                    if (targetPath) {
                        const target = await this.core.loadByPath(this.rootNode, targetPath);
                        const targetCopy = this.core.copyNode(target, snapshot);
                        this.core.setPointer(snapshot, name, targetCopy);
                    }
                })
            );
            await setPointers;

            // Copy the data I/O
            const metaTypeComparator = (a, b) => {
                const aId = this.core.getPath(this.core.getMetaType(a));
                const bId = this.core.getPath(this.core.getMetaType(b));

                return aId < bId ? -1 : 1;
            };

            const srcCntrs = (await this.core.loadChildren(node))
                .sort(metaTypeComparator);
            const [dstInput, dstOutput] = (await this.core.loadChildren(snapshot))
                .sort(metaTypeComparator);

            const [srcInputs, srcOutputs] = (await Promise.all(srcCntrs.map(ctr => this.core.loadChildren(ctr))));

            const copies = srcInputs.map(n => {
                const copy = this.core.copyNode(n, dstInput);
                const inheritancePath = this.getInheritedAncestors(n);
                const dataMetaNode = inheritancePath.reverse()
                    .find(node => this.core.getAttribute(node, 'name') === 'Data');
                this.core.setPointer(copy, 'base', dataMetaNode);
                this.core.setAttribute(copy, 'name', this.core.getAttribute(n, 'name'));
                return copy;
            });
            copies.push(...srcOutputs.map(n => this.shallowCopy(n, dstOutput)));
            const oldNewPairs = _.zip(srcInputs.concat(srcOutputs), copies);
            oldNewPairs.push([node, snapshot]);
            return {snapshot, pairs: oldNewPairs};
        }

        getInheritedAncestors (node) {
            const path = [];
            while (node) {
                path.push(node);
                node = this.core.getBase(node);
            }
            return path;
        }

        shallowCopy (original, dst) {
            const attrNames = this.core.getAttributeNames(original);
            const copy = this.core.createNode({
                base: this.core.getMetaType(original),
                parent: dst
            });

            const values = attrNames.map(name => this.core.getAttribute(original, name));
            attrNames.forEach((name, i) =>
                this.core.setAttribute(copy, name, values[i]));

            return copy;
        }

        async setDataContents(node, dataNode) {
            const dataType = this.core.getAttribute(dataNode, 'type');
            this.core.setAttribute(node, 'type', dataType);

            const hash = this.core.getAttribute(dataNode, 'data');
            this.core.setAttribute(node, 'data', hash);

            const provOutput = this.core.getAttribute(dataNode, 'provOutput');
            if (provOutput) {
                this.core.setAttribute(node, 'provOutput', provOutput);
            }

            await this.clearProvenance(node);

            const provDataId = this.core.getPointerPath(dataNode, 'provenance');
            if (provDataId) {
                const implOp = await this.core.loadByPath(this.rootNode, provDataId);
                const provCopy = this.core.copyNode(implOp, node);
                this.core.setPointer(node, 'provenance', provCopy);
            }
        }

        async clearProvenance(dataNode) {
            const provDataId = this.core.getPointerPath(dataNode, 'provenance');
            if (provDataId) {
                const provData = await this.core.loadByPath(this.rootNode, provDataId);
                const {node} = this.getImplicitOperation(provData);
                this.core.deleteNode(node);
            }
        }

        getImplicitOperation(dataNode) {
            const metanodes = Object.values(this.core.getAllMetaNodes(dataNode));
            const implicitOp = metanodes
                .find(node => this.core.getAttribute(node, 'name') === 'ImplicitOperation');
            let node = dataNode;
            const path = [];
            while (node && !this.core.isTypeOf(node, implicitOp)) {
                path.push(this.core.getAttribute(node, 'name'));
                node = this.core.getParent(node);
            }

            return {node, path};
        }
    }
    
    return ExecutionHelpers;
});
