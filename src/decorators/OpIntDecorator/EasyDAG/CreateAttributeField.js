/* globals define */
define([
], function(
) {

    var CreateAttrField = function(logger, pEl, y) {
        this.$el = pEl.append('text')
            .attr('y', y)
            .attr('class', 'create-attr-field')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-weight', 'bold')
            .attr('font-style', 'italic')
            .text('New Attribute')
            .on('click', () => this.onClick());
    };

    CreateAttrField.prototype.render =
    CreateAttrField.prototype.destroy = function() {};

    CreateAttrField.prototype.width = function() {
        return this.$el[0][0].getBoundingClientRect().width;
    };

    return CreateAttrField;
});
