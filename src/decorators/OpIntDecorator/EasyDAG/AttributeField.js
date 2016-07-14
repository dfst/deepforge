/* globals define, _*/
define([
    'decorators/EllipseDecorator/EasyDAG/AttributeField'
], function(
    AttributeFieldBase
) {
    // Attribute field in which the label is clickable and the attribute meta is editable
    var AttributeField = function() {
        AttributeFieldBase.apply(this, arguments);
        this.$label.on('click', () => this.onLabelClick());
    };

    _.extend(AttributeField.prototype, AttributeFieldBase.prototype);

    return AttributeField;
});
