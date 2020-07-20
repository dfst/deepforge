/*globals define */

define([
    'panels/InteractiveEditor/InteractiveEditorControl',
], function (
    InteractiveEditorControl,
) {

    'use strict';

    class InteractiveExplorerControl extends InteractiveEditorControl {
        ensureValidSnapshot(desc) {
            const metadata = this.getMetaNode('pipeline.Metadata');
            const type = this.getMetaNode(desc.type);

            if (!type) {
                throw new Error(`Invalid metadata type: ${type}`);
            }

            if (!type.isTypeOf(metadata.getId())) {
                throw new Error('Explorer can only create artifact metadata');
            }
        }

        save() {
            const snapshotDesc = this._widget.getSnapshot();
            this.ensureValidSnapshot(snapshotDesc);

            const features = this._widget.getCapabilities();
            this.client.startTransaction();
            const data = this.createNode(snapshotDesc);
            if (features.provenance) {
                const implicitOp = this.createNode(this._widget.getEditorState(), data);
                this.client.setPointer(data.getId(), 'provenance', implicitOp.getId());
                const operation = this.createNode(this._widget.getOperation(), implicitOp);
                this.client.setPointer(implicitOp.getId(), 'operation', operation.getId());
            }
            this.client.completeTransaction();
        }

    }

    return InteractiveExplorerControl;
});
