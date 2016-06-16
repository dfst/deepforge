/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'css!./JobDecorator.EasyDAGWidget.css'
], function (
    EllipseDecorator
) {

    'use strict';

    var JobDecorator,
        DECORATOR_ID = 'JobDecorator',
        COLORS = {
            pending: '#9e9e9e',
            running: '#fff59d',
            success: '#66bb6a',
            fail: '#e57373'
        };

    // Job nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    JobDecorator = function (options) {
        options.skipAttributes = {
            name: true,
            status: true,
            stdout: true,
            debug: true
        };
        EllipseDecorator.call(this, options);
    };

    _.extend(JobDecorator.prototype, EllipseDecorator.prototype);

    JobDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    JobDecorator.prototype.getDisplayName = function() {
        return this._node.name;
    };

    JobDecorator.prototype.setAttributes = function() {
        EllipseDecorator.prototype.setAttributes.call(this);
        var attrs = this._node.attributes,
            status = attrs.status && attrs.status.value;

        // Update the color based on the 'status' attr
        this.color = COLORS[status] || COLORS.fail;
    };

    return JobDecorator;
});
