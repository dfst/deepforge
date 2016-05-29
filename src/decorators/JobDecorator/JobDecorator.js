/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/JobDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    JobDecoratorEasyDAGWidget
) {

    'use strict';

    var JobDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'JobDecorator';

    JobDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('JobDecorator ctor');
    };

    _.extend(JobDecorator.prototype, __parent_proto__);
    JobDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    JobDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: JobDecoratorEasyDAGWidget
        };
    };

    return JobDecorator;
});
