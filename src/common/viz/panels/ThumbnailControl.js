/* globals define */
define([
    'panels/EasyDAG/EasyDAGControl'
], function(
    EasyDAGControl
) {
    var ThumbnailControl = function() {
        EasyDAGControl.apply(this, arguments);
    };

    ThumbnailControl.prototype = Object.create(EasyDAGControl.prototype);

    ThumbnailControl.prototype._initWidgetEventHandlers = function () {
        EasyDAGControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.updateThumbnail = this.updateThumbnail.bind(this);
    };

    ThumbnailControl.prototype.updateThumbnail = function (svg) {
        var node = this._client.getNode(this._currentNodeId),
            name,
            attrs,
            currentThumbnail,
            attrName = 'thumbnail',
            msg;

        if (node) {  // may have been deleted
            name = node.getAttribute('name');
            attrs = node.getValidAttributeNames();
            currentThumbnail = node.getAttribute(attrName);
            msg = `Updating pipeline thumbnail for "${name}"`;

            if (attrs.indexOf(attrName) > -1 && currentThumbnail !== svg) {
                this._client.startTransaction(msg);
                this._client.setAttribute(this._currentNodeId, attrName, svg);
                this._client.completeTransaction();
            }
        }
    };

    return ThumbnailControl;
});
