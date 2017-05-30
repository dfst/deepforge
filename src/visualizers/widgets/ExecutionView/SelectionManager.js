/*globals define*/

define([
    'widgets/EasyDAG/SelectionManager',
    'widgets/EasyDAG/Buttons',
    'deepforge/Constants',
    'underscore'
], function(
    EasyDAGSelectionManager,
    Buttons,
    CONSTANTS,
    _
) {
    'use strict';

    var SelectionManager = function(widget) {
        EasyDAGSelectionManager.call(this, widget);
    };

    _.extend(SelectionManager.prototype, EasyDAGSelectionManager.prototype);

    SelectionManager.prototype.createActionButtons = function(width/*, height*/) {
        var jobName = this.selectedItem.desc.name;

        // Check if it is an Input or Output job
        if (!this.selectedItem.isConnection && jobName !== CONSTANTS.OP.INPUT &&
            jobName !== CONSTANTS.OP.OUTPUT) {

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
