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

    var SerializeEditorControl;

    SerializeEditorControl = function (options) {
        options.attributeName = 'serialize';
        TextEditorControl.call(this, options);
        this._widget.setName = this.setName.bind(this);
    };

    _.extend(
        SerializeEditorControl.prototype,
        TextEditorControl.prototype
    );

    // input/output updates are actually activeNode updates
    SerializeEditorControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId) {
            TextEditorControl.prototype._onUpdate.call(this, this._currentNodeId);
        }
    };

    return SerializeEditorControl;
});
