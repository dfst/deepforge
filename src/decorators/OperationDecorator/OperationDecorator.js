/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/OperationDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    OperationDecoratorEasyDAGWidget
) {

    'use strict';

    var OperationDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'OperationDecorator';

    OperationDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('OperationDecorator ctor');
    };

    _.extend(OperationDecorator.prototype, __parent_proto__);
    OperationDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    OperationDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: OperationDecoratorEasyDAGWidget
        };
    };

    return OperationDecorator;
});
