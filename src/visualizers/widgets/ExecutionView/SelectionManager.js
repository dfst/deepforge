/*globals define*/

define([
    'widgets/EasyDAG/SelectionManager',
    'underscore'
], function(
    EasyDAGSelectionManager,
    _
) {
    'use strict';

    var SelectionManager = function(widget) {
        EasyDAGSelectionManager.call(this, widget);
    };

    _.extend(SelectionManager.prototype, EasyDAGSelectionManager.prototype);

    SelectionManager.prototype.createActionButtons = function(/*width, height*/) {
        // Add restart btn, etc
        // TODO
    };

    return SelectionManager;
});
