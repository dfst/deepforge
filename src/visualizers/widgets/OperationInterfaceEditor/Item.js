/*globals define*/
define([
    'widgets/EasyDAG/DAGItem',
    'underscore'
], function(
    DAGItem,
    _
) {
    
    var Item = function(parentEl, desc) {
        DAGItem.call(this, parentEl, desc);
    };

    _.extend(Item.prototype, DAGItem.prototype);
    
    Item.prototype.setupDecoratorCallbacks = function() {
        DAGItem.prototype.setupDecoratorCallbacks.call(this);
        // Add ptr name change
        this.decorator.changePtrName = this.changePtrName.bind(this);
    };

    return Item;
});
