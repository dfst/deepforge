/*globals define, _*/
/*jshint browser: true, camelcase: false*/

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/ContainerLayerDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    ContainerLayerDecoratorEasyDAGWidget
) {

    'use strict';

    var ContainerLayerDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'ContainerLayerDecorator';

    ContainerLayerDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('ContainerLayerDecorator ctor');
    };

    _.extend(ContainerLayerDecorator.prototype, __parent_proto__);
    ContainerLayerDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    ContainerLayerDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: ContainerLayerDecoratorEasyDAGWidget
        };
    };

    return ContainerLayerDecorator;
});
