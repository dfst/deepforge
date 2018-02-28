/*globals define */
/*jshint browser: true*/

define([
    'widgets/PipelineIndex/PipelineIndexWidget'
], function (
    PipelineIndexWidget
) {
    'use strict';

    var ResourceIndexWidget = function () {
        PipelineIndexWidget.apply(this, arguments);
    };

    ResourceIndexWidget.prototype = Object.create(PipelineIndexWidget.prototype);

    ResourceIndexWidget.prototype.getEmptyMsg = function() {
        // TODO: If no resources supported, then prompt about loading them?
        return 'No Existing Resources...';
    };

    return ResourceIndexWidget;
});
