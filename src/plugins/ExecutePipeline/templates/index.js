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

    return {
        ENTRY,
        MAIN,
        SERIALIZE,
        DESERIALIZE
    };
});
