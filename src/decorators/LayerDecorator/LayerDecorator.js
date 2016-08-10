/*globals define, _*/
/*jshint browser: true, camelcase: false*/

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/LayerDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    LayerDecoratorEasyDAGWidget
) {

    'use strict';

    var LayerDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'LayerDecorator';

    LayerDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('LayerDecorator ctor');
    };

    _.extend(LayerDecorator.prototype, __parent_proto__);
    LayerDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    LayerDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: LayerDecoratorEasyDAGWidget
        };
    };

    return LayerDecorator;
});
