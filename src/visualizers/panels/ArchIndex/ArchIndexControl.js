/* globals define */
define([
    'panels/PipelineIndex/PipelineIndexControl'
], function(
    PipelineIndexControl
) {
    var ArchIndexControl = function() {
        PipelineIndexControl.apply(this, arguments);
    };

    ArchIndexControl.prototype = Object.create(PipelineIndexControl.prototype);
    ArchIndexControl.prototype._getObjectDescriptor = function (nodeId) {
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

    ArchIndexControl.prototype._initWidgetEventHandlers = function () {
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
    };
    return ArchIndexControl;
});
