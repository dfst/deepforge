/*globals define*/

define([
    'widgets/EasyDAG/SelectionManager',
    'deepforge/viz/Buttons',
    'underscore'
], function(
    EasyDAGSelectionManager,
    Buttons,
    _
) {
    'use strict';

    var SelectionManager = function(widget) {
        EasyDAGSelectionManager.call(this, widget);
    };

    _.extend(SelectionManager.prototype, EasyDAGSelectionManager.prototype);

    SelectionManager.prototype.createActionButtons = function(width, height, transition) {
        // move the 'x' to the top left
        new Buttons.DeleteOne({
            context: this._widget,
            $pEl: this.$selection,
            transition: transition,
            item: this.selectedItem,
            x: 0,
            y: 0
        });

        if (!this.selectedItem.isConnection) {
            // If the operation has a user-defined base type,
            // show a button for jumping to the base def
            new Buttons.GoToBase({
                $pEl: this.$selection,
                context: this._widget,
                transition: transition,
                title: 'Edit operation definition',
                item: this.selectedItem,
                x: width,
                y: 0
            });
        }
    };

    SelectionManager.prototype.createAltActionButtons = function(width, height, tr) {
        // move the 'x' to the top left
        new Buttons.DeleteOne({
            context: this._widget,
            $pEl: this.$selection,
            item: this.selectedItem,
            transition: tr,
            x: 0,
            y: 0
        });

        if (!this.selectedItem.isConnection) {
            // If the operation has a user-defined base type,
            // show a button for jumping to the base def
            new Buttons.CloneAndEdit({
                $pEl: this.$selection,
                context: this._widget,
                transition: tr,
                title: 'Create new operation',
                item: this.selectedItem,
                x: width,
                y: 0
            });
        }
    };

    return SelectionManager;
});
