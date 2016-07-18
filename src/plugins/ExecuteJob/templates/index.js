/*globals define*/
define([
    'text!./entry.ejs',
    'text!./main.ejs',
    'text!./serialize.ejs',
    'text!./deserialize.ejs'
], function(
    ENTRY,
    MAIN,
    SERIALIZE,
    DESERIALIZE
) {

    var BASH = 'th init.lua  2>&1';
    return {
        BASH,
        ENTRY,
        MAIN,
        SERIALIZE,
        DESERIALIZE
    };
});
