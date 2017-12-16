/*globals define*/
define([
    'text!./start.ejs',
    'text!./main.ejs',
    'text!./deepforge.ejs',
    'text!./serialize.ejs',
    'text!./deserialize.ejs'
], function(
    START,
    MAIN,
    DEEPFORGE,
    SERIALIZE,
    DESERIALIZE
) {

    return {
        START,
        MAIN,
        SERIALIZE,
        DEEPFORGE,
        DESERIALIZE
    };
});
