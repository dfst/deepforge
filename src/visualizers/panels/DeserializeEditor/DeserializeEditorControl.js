/*globals define */
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'underscore'
], function (
    TextEditorControl,
    _
) {

    'use strict';

    var DeserializeEditorControl;

    DeserializeEditorControl = function (options) {
        options.attributeName = 'deserialize';
        TextEditorControl.call(this, options);
    };

    _.extend(
        DeserializeEditorControl.prototype,
        TextEditorControl.prototype
    );

    // input/output updates are actually activeNode updates
    DeserializeEditorControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId) {
            TextEditorControl.prototype._onUpdate.call(this, this._currentNodeId);
        }
    };

    return DeserializeEditorControl;
});
