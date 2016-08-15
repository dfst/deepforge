/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'decorators/OpIntDecorator/EasyDAG/OpIntDecorator.EasyDAGWidget',
    'css!./OpIntPtrDecorator.EasyDAGWidget.css'
], function (
    DecoratorBase
) {

    'use strict';

    var OpIntPtrDecorator,
        DECORATOR_ID = 'OpIntPtrDecorator';

    // OpInt nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    OpIntPtrDecorator = function (options) {
        this.color = '#80deea';
        DecoratorBase.call(this, options);
    };

    _.extend(OpIntPtrDecorator.prototype, DecoratorBase.prototype);

    OpIntPtrDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    OpIntPtrDecorator.prototype.onValidNameChange  = function(newValue) {
        return this.changePtrName(this.name, newValue);
    };

    return OpIntPtrDecorator;
});
