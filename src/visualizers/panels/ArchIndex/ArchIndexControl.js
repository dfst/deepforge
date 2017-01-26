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

    return ArchIndexControl;
});
