/* globals _, define*/
define([
    'widgets/EasyDAG/SelectionManager',
    'deepforge/viz/Buttons'
], function(
    ManagerBase,
    Buttons
) {

    var SelectionManager = function() {
        ManagerBase.apply(this, arguments);
    };

    _.extend(SelectionManager.prototype, ManagerBase.prototype);

    SelectionManager.prototype.createActionButtons = function(width, height) {
        var btn;

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
            // Check that the base type
            btn = new Buttons.GoToBase({
                $pEl: this.$selection,
                context: this._widget,
                title: 'Edit layer definition',
                item: this.selectedItem,
                x: width,
                y: 0
            });
        }

        return btn;
    };

    return SelectionManager;
});
