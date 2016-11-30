/* globals _, WebGMEGlobal, define*/
define([
    'widgets/EasyDAG/SelectionManager',
    'deepforge/viz/Buttons'
], function(
    ManagerBase,
    Buttons
) {

    var client = WebGMEGlobal.Client;
    var SelectionManager = function() {
        ManagerBase.apply(this, arguments);
    };

    _.extend(SelectionManager.prototype, ManagerBase.prototype);

    SelectionManager.prototype.createActionButtons = function(width, height) {
        var disabled,
            btn;

        ManagerBase.prototype.createActionButtons.call(this, width, height);

        if (this.selectedItem.isConnection) {
            btn = new Buttons.Insert({
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                x: width/2,
                y: height/2
            });
        } else {
            disabled = !this._isCustomLayer();
            // Check that the base type
            btn = new Buttons.GoToBase({
                $pEl: this.$selection,
                context: this._widget,
                title: 'Edit layer definition',
                item: this.selectedItem,
                disabled: disabled,
                x: width,
                y: 0
            });
        }

        return btn;
    };

    SelectionManager.prototype._isCustomLayer = function() {
        var node = client.getNode(this.selectedItem.id),
            attrNames;

        if (node) {
            attrNames = node.getAttributeNames();
            return attrNames.indexOf('code') !== -1;
        }

        return false;
    };

    return SelectionManager;
});
