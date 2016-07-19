/*globals define */
define([
    'widgets/EasyDAG/DAGItem',
    'underscore'
], function(
    DAGItem,
    _
) {
    
    var Item = function(parentEl, desc) {
        DAGItem.call(this, parentEl, desc);

        // Show the warnings
        this.$warning = null;
        this.updateWarnings();
    };

    _.extend(Item.prototype, DAGItem.prototype);
    
    Item.prototype.update = function(desc) {
        DAGItem.prototype.update.call(this, desc);
        this.updateWarnings();
    };

    Item.prototype.updateWarnings = function() {
        var isInput = this.desc.container === 'inputs',
            msg = 'Unused ' + (isInput ? 'Input' : 'Output') + '!';

        if (this.desc.used === false) {
            this.warn(msg, isInput ? 'bottom' : 'top');
        } else {
            this.clearWarning();
        }
    };

    Item.prototype.warn = function(message, tipJoint) {
        // Create a temporary div over the given svg element
        if (this.$warning) {
            this.clearWarning();
        }

        this.decorator.highlight('#ffeb3b');
        this.$warning = this.createTooltip(message, {
            showIf: () => !this.isSelected(),
            tipJoint: tipJoint,
            style: 'standard'
        });
    };

    Item.prototype.clearWarning = function() {
        if (this.$warning) {
            this.destroyTooltip(this.$warning);
            this.$warning = null;
        }
        this.decorator.unHighlight();
    };


    Item.prototype.onSelect = function() {
        DAGItem.prototype.onSelect.call(this);
        if (this.$warning) {
            this.$warning.hide();
        }
    };

    Item.prototype.setupDecoratorCallbacks = function() {
        DAGItem.prototype.setupDecoratorCallbacks.call(this);
        // Add ptr name change
        this.decorator.changePtrName = this.changePtrName.bind(this);
    };

    return Item;
});
