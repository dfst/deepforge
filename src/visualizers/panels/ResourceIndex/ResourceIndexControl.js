/* globals define */
define([
    'js/DragDrop/DragHelper',
    'panels/PipelineIndex/PipelineIndexControl'
], function(
    DragHelper,
    PipelineIndexControl
) {
    var ResourceIndexControl = function() {
        PipelineIndexControl.apply(this, arguments);
    };

    ResourceIndexControl.prototype = Object.create(PipelineIndexControl.prototype);
    ResourceIndexControl.prototype._getObjectDescriptor = function (nodeId) {
        var node = this._client.getNode(nodeId),
            base,
            desc;

        if (node) {
            base = this._client.getNode(node.getBaseId());
            desc = {
                id: node.getId(),
                name: node.getAttribute('name'),
                parentId: node.getParentId(),
                thumbnail: node.getAttribute('thumbnail'),
                type: base.getAttribute('name')
            };
        }

        return desc;
    };

    ResourceIndexControl.prototype._initWidgetEventHandlers = function () {
        this._widget.deletePipeline = id => {
            var node = this._client.getNode(id),
                name = node.getAttribute('name'),
                msg = `Deleted "${name}" architecture`;


            this._client.startTransaction(msg);
            this._client.deleteNode(id);
            this._client.completeTransaction();
        };

        this._widget.setName = (id, name) => {
            var oldName = this._client.getNode(id).getAttribute('name'),
                msg = `Renaming architecture: "${oldName}" -> "${name}"`;

            if (oldName !== name && !/^\s*$/.test(name)) {
                this._client.startTransaction(msg);
                this._client.setAttribute(id, 'name', name);
                this._client.completeTransaction();
            }
        };
        
        this._widget.onBackgroundDrop = (event, dragInfo) => {
            if (!this._currentNodeId) {  // no active node. Cannot add pipeline
                return;
            }
            const effects = DragHelper.getDragEffects(dragInfo);
            const items = DragHelper.getDragItems(dragInfo);

            if (effects.includes(DragHelper.DRAG_EFFECTS.DRAG_CREATE_INSTANCE)) {
                const parentId = this._currentNodeId;
                const msg = `Creating ${items.length} new resource(s)`;
                this._client.startTransaction(msg);
                items.forEach(baseId => this._client.createNode({parentId, baseId}));
                this._client.completeTransaction();
            }
        };
    };
    return ResourceIndexControl;
});
