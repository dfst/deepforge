/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/OpIntPtrDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    OpIntPtrDecoratorEasyDAGWidget
) {

    'use strict';

    var OpIntPtrDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'OpIntPtrDecorator';

    OpIntPtrDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('OpIntPtrDecorator ctor');
    };

    _.extend(OpIntPtrDecorator.prototype, __parent_proto__);
    OpIntPtrDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    OpIntPtrDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: OpIntPtrDecoratorEasyDAGWidget
        };
    };

    return OpIntPtrDecorator;
});
