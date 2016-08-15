/*globals define*/
define([
    'decorators/EllipseDecorator/EasyDAG/AttributeField'
], function(
    BaseAttributeField
) {
    var AttributeField = function() {
        BaseAttributeField.apply(this, arguments);
    };

    AttributeField.prototype = Object.create(BaseAttributeField.prototype);

    AttributeField.prototype.onClick = function() {
    };

    return AttributeField;
});
