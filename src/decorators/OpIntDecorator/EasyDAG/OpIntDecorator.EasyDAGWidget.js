/*globals define, $,_*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'css!./OpIntDecorator.EasyDAGWidget.css'
], function (
    DecoratorBase
) {

    'use strict';

    var OpIntDecorator,
        DECORATOR_ID = 'OpIntDecorator';

    // OpInt nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    OpIntDecorator = function (options) {
        this.color = this.color || '#78909c';
        DecoratorBase.call(this, options);
    };

    _.extend(OpIntDecorator.prototype, DecoratorBase.prototype);

    OpIntDecorator.prototype.DECORATOR_ID = DECORATOR_ID;
    OpIntDecorator.prototype.initialize = function() {
        if (this._node.baseName === 'Operation') {
            this.color = '#2196f3';
        } else if (this._node.baseName) {
            // On hover, show the type
            this.enableTooltip(this._node.baseName, 'dark');
        }
        DecoratorBase.prototype.initialize.call(this);
        this.$name.on('dblclick', this.editName.bind(this));
    };

    OpIntDecorator.prototype.editName = function() {
        var html = this.$name[0][0],
            position = html.getBoundingClientRect(),

            width = Math.max(position.right-position.left, 15),
            container = $('<div>'),
            parentHtml = $('body');

        // foreignObject was not working so we are using a tmp container
        // instead
        container.css('top', position.top);
        container.css('left', position.left);
        container.css('position', 'absolute');
        container.css('width', width);
        container.attr('id', 'CONTAINER-TMP');

        $(parentHtml).append(container);

        container.editInPlace({
            enableEmpty: true,
            value: this.name,
            css: {
                'z-index': 10000,
                'id': 'asdf',
                'width': width,
                'xmlns': 'http://www.w3.org/1999/xhtml'
            },
            onChange: this.onNameChanged.bind(this),
            onFinish: function () {
                $(this).remove();
            }
        });
    };

    OpIntDecorator.prototype.onNameChanged = function(oldVal, newValue) {
        var whitespace = /^\s*$/;
        if (newValue !== oldVal && !whitespace.test(newValue)) {
            this.onValidNameChange(newValue);
        }
    };

    OpIntDecorator.prototype.onValidNameChange = function(newValue) {
        this.saveAttribute('name', newValue);
    };

    OpIntDecorator.prototype.getDisplayName = function() {
        return this._node.name;
    };

    // clicking on the name should allow the user to edit it in place
    // TODO

    return OpIntDecorator;
});
