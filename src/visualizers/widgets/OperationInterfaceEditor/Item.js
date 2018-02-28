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
        this.decorator.color = desc.displayColor || this.decorator.color;

        this._hovering = false;
        this.$el.on('mouseenter', () => this.onHover());
        this.$el.on('mouseleave', () => this._hovering && this.onUnhover());

        // Show the warnings
        this.$warning = null;
        this.updateWarnings();

    };

    _.extend(Item.prototype, DAGItem.prototype);

    Item.prototype.onUnhover = function() {
        this._hovering = false;
        this.hideHoverButtons();
    };

    Item.prototype.onHover = function() {
        if (!this.isSelected()) {
            this._hovering = true;
            this.showHoverButtons();
        }
    };
    
    Item.prototype.update = function(desc) {
        this.decorator.color = desc.displayColor || this.decorator.color;
        DAGItem.prototype.update.call(this, desc);
        this.updateWarnings();
    };

    Item.prototype.updateWarnings = function() {
        var isInput = this.desc.container === 'inputs',
            msg = 'Unused ' + (isInput ? 'Input' : 'Output') + '!';

        if (this.desc.used === false) {
            this.warn(msg, isInput ? 'bottom' : 'top');
        } else {
            this.clearNotification('$warning');
        }

        if (this.desc.isUnknown) {  // ptrs only
            this.error('Unknown type! Click to set', 'bottom');
        } else if (this.$error) {
            // Set the baseName tooltip, if needed
            this.clearNotification('$error');
            this.decorator.enableTooltip(this.desc.baseName, 'dark');
        }
    };

    Item.prototype.warn = function(message, tipJoint) {
        this.notify(message, '$warning', '#ffeb3b', 'standard', tipJoint);
    };

    Item.prototype.error = function(message, tipJoint) {
        this.notify(message, '$error', '#ef5350', 'alert', tipJoint);
    };

    Item.prototype.notify = function(message, varname, color, style, tipJoint) {
        this.clearNotification(varname);

        this.decorator.highlight(color);
        this[varname] = this.createTooltip(message, {
            showIf: () => !this.isSelected(),
            tipJoint: tipJoint,
            style: style
        });
    };

    Item.prototype.clearNotification = function(varname) {
        if (this[varname]) {
            this.destroyTooltip(this[varname]);
            this[varname] = null;
        }
        this.decorator.unHighlight();
    };

    Item.prototype.onSelect = function() {
        DAGItem.prototype.onSelect.call(this);
        if (this.$warning) {
            this.$warning.hide();
        }

        // Add click listener to set type
        if (this.desc.isUnknown) {
            this.onSetRefClicked(this.desc.name);
        }

        if (this._hovering) {
            this.onUnhover();
        }
    };

    Item.prototype.setupDecoratorCallbacks = function() {
        DAGItem.prototype.setupDecoratorCallbacks.call(this);
        // Add ptr name change
        this.decorator.changePtrName = this.changePtrName.bind(this);
        this.decorator.setAttributeMeta = this.setAttributeMeta.bind(this);
        this.decorator.deleteAttribute = this.deleteAttribute.bind(this);
    };

    return Item;
});
