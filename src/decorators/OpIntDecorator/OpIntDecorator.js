/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/OpIntDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    OpIntDecoratorEasyDAGWidget
) {

    'use strict';

    var OpIntDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'OpIntDecorator';

    OpIntDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('OpIntDecorator ctor');
    };

    _.extend(OpIntDecorator.prototype, __parent_proto__);
    OpIntDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    OpIntDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: OpIntDecoratorEasyDAGWidget
        };
    };

    return OpIntDecorator;
});
