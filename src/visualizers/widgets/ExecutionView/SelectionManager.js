/*globals define*/

define([
    'widgets/EasyDAG/SelectionManager',
    'widgets/EasyDAG/Buttons',
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

    SelectionManager.prototype.createActionButtons = function(width/*, height*/) {
        if (!this.selectedItem.isConnection) {
            new Buttons.Enter({
                context: this._widget,
                $pEl: this.$selection,
                title: 'View output',
                item: this.selectedItem,
                icon: 'monitor',
                x: width,
                y: 0
            });
        }
    };

    return SelectionManager;
});
