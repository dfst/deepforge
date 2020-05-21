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

            const names = this.core.getValidAttributeNames(node);
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
            const [srcInputs, srcOutputs] = await Promise.all(srcCntrs.map(ctr => this.core.loadChildren(ctr)));
            const copies = srcInputs.map(n => this.core.copyNode(n, dstInput));
            copies.push(...srcOutputs.map(n => this.shallowCopy(n, dstOutput)));
            const oldNewPairs = _.zip(srcInputs.concat(srcOutputs), copies);
            oldNewPairs.push([node, snapshot]);
            return {snapshot, pairs: oldNewPairs};
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
    }
    
    return ExecutionHelpers;
});
