/* globals define, _ */
define([
    'decorators/EllipseDecorator/EasyDAG/PointerField'
], function(
    PointerField
) {
    // The LayerField behaves the same as PointerFields but it shows "click to view"
    // if it has a value
    var LayerField = function() {
        PointerField.apply(this, arguments);
    };

    _.extend(LayerField.prototype, PointerField.prototype);

    LayerField.prototype.getContent = function(content) {
        return content && 'click to view';
    };

    LayerField.prototype.createContent = function(w, y, content) {
        PointerField.prototype.createContent.call(this, w, y, this.getContent(content));
        this.$content.attr('font-style', 'italic');
    };

    LayerField.prototype.setValue = function(content) {
        PointerField.prototype.setValue.call(this, this.getContent(content));
    };

    return LayerField;
});
