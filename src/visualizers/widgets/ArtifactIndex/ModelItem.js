/*globals define, $*/
define([
    'text!./ModelRow.html'
], function(
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
        this.$download = this.$el.find('.data-download');
        this.$delete = this.$el.find('.data-remove');
    };

    ModelItem.prototype.update = function(node) {
        // Set the row fields and stuff
        this.$name.text(node.name);
        this.$type.text(node.type || 'unknown');

        // TODO: Get the size from the metadata...
        this.$size.text(node.data || 'unknown');
        this.$download.text(node.status);
    };

    ModelItem.prototype.remove = function() {
        this.$el.remove();
    };

    return ModelItem;
});
