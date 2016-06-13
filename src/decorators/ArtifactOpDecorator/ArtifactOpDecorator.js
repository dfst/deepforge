/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Decorators/DecoratorBase',
    './EasyDAG/ArtifactOpDecorator.EasyDAGWidget'
], function (
    DecoratorBase,
    ArtifactOpDecoratorEasyDAGWidget
) {

    'use strict';

    var ArtifactOpDecorator,
        __parent__ = DecoratorBase,
        __parent_proto__ = DecoratorBase.prototype,
        DECORATOR_ID = 'ArtifactOpDecorator';

    ArtifactOpDecorator = function (params) {
        var opts = _.extend({loggerName: this.DECORATORID}, params);

        __parent__.apply(this, [opts]);

        this.logger.debug('ArtifactOpDecorator ctor');
    };

    _.extend(ArtifactOpDecorator.prototype, __parent_proto__);
    ArtifactOpDecorator.prototype.DECORATORID = DECORATOR_ID;

    /*********************** OVERRIDE DecoratorBase MEMBERS **************************/

    ArtifactOpDecorator.prototype.initializeSupportedWidgetMap = function () {
        this.supportedWidgetMap = {
            EasyDAG: ArtifactOpDecoratorEasyDAGWidget
        };
    };

    return ArtifactOpDecorator;
});
