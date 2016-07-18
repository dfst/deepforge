/*globals define */
/*jshint browser: true*/

define([
    'panels/SerializeEditor/SerializeEditorControl',
    'panels/TextEditor/TextEditorControl',
    'underscore'
], function (
    SerializeEditorControl,
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
        SerializeEditorControl.prototype
    );

    return DeserializeEditorControl;
});
