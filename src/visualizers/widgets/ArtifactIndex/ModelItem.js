/*globals define, $*/
define([
    'deepforge/viz/Utils',
    'text!./ModelRow.html'
], function(
    Utils,
    ROW_HTML
) {
    'use strict';
    
    var ModelItem = function(parent, node) {
        this.$el = $(ROW_HTML);
        this.initialize();
        this.update(node);
        parent.append(this.$el);
    };

    ModelItem.prototype.initialize = function() {
        // Get the fields and stuff
        this.$name = this.$el.find('.name');
        this.$type = this.$el.find('.type');
        this.$size = this.$el.find('.size');
        this.$createdAt = this.$el.find('.createdAt');
        this.$download = this.$el.find('.data-download');
        this.$delete = this.$el.find('.data-remove');
        this.$info = this.$el.find('.data-info');
    };

    ModelItem.prototype.update = function(node) {
        var date = node.createdAt ? Utils.getDisplayTime(node.createdAt) : 'unknown';

        this.$name.text(node.name);
        this.$type.text(node.type || 'unknown');
        this.$size.text(node.size || 'unknown');
        this.$createdAt.text(date);
    };

    ModelItem.prototype.remove = function() {
        this.$el.remove();
    };

    return ModelItem;
});
