/*globals define, _*/
/*jshint browser: true*/

// This is a read-only view of the 'stdout' attribute for a Job node
define([
    'panels/TextEditor/TextEditorControl'
], function (
    TextEditorControl
) {

    'use strict';

    var LogViewerControl;

    LogViewerControl = function (options) {
        options.attributeName = 'stdout';
        TextEditorControl.call(this, options);
    };

    _.extend(LogViewerControl.prototype, TextEditorControl.prototype);

    LogViewerControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId) {
            TextEditorControl.prototype._onUpdate.call(this, id);
        }
    };

    return LogViewerControl;
});
