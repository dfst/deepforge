/*globals define */
/*jshint browser: true*/

define([
    'panels/SerializeEditor/SerializeEditorControl',
    'underscore'
], function (
    SerializeEditorControl,
    _
) {

    'use strict';

    var DeserializeEditorControl;

    DeserializeEditorControl = function (options) {
        options.attributeName = 'deserialize';
        SerializeEditorControl.call(this, options);
    };

    _.extend(
        DeserializeEditorControl.prototype,
        SerializeEditorControl.prototype
    );

    return DeserializeEditorControl;
});
