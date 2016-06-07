/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/DcOpDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    DcOpDecoratorEasyDAGWidget
) {

    'use strict';

    var DcOpDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'DcOpDecorator';

    DcOpDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('DcOpDecorator ctor');
    };

    _.extend(DcOpDecorator.prototype, __parent_proto__);
    DcOpDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    DcOpDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: DcOpDecoratorEasyDAGWidget
        };
    };

    return DcOpDecorator;
});
