/*globals define */
/*jshint browser: true*/

define([
    'widgets/PipelineIndex/PipelineIndexWidget'
], function (
    PipelineIndexWidget
) {
    'use strict';

    var ArchIndexWidget = function () {
        PipelineIndexWidget.apply(this, arguments);
    };

    ArchIndexWidget.prototype = Object.create(PipelineIndexWidget.prototype);

    ArchIndexWidget.prototype.getEmptyMsg = function() {
        return 'No Existing Architectures...';
    };

    return ArchIndexWidget;
});
