/*globals define*/
define([
    'text!./start.ejs',
    'text!./entry.ejs',
    'text!./main.ejs',
    'text!./deepforge.ejs',
    'text!./serialize.ejs',
    'text!./deserialize.ejs'
], function(
    START,
    ENTRY,
    MAIN,
    DEEPFORGE,
    SERIALIZE,
    DESERIALIZE
) {

    return {
        START,
        ENTRY,
        MAIN,
        SERIALIZE,
        DEEPFORGE,
        DESERIALIZE
    };
});
