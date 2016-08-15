/*globals define*/
define([
    'decorators/EllipseDecorator/EasyDAG/PointerField'
], function(
    BasePointerField
) {
    var PointerField = function() {
        BasePointerField.apply(this, arguments);
    };

    PointerField.prototype = Object.create(BasePointerField.prototype);

    PointerField.prototype.onClick = function() {
    };

    // Remove the delete icon and adjust the text location
    PointerField.prototype.hasIcon = function() {
        return false;
    };

    return PointerField;
});
