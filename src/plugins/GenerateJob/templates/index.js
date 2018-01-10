/*globals define*/
define([
    'text!./start.ejs',
    'text!./main.ejs',
    'text!./deepforge.ejs',
    'text!./deepforge__init__.py',
    'text!./serialize.ejs',
    'text!./deserialize.ejs'
], function(
    START,
    MAIN,
    DEEPFORGE_SERIALIZATION,
    DEEPFORGE_INIT,
    SERIALIZE,
    DESERIALIZE
) {

    return {
        START,
        MAIN,
        SERIALIZE,
        DEEPFORGE_SERIALIZATION,
        DEEPFORGE_INIT,
        DESERIALIZE
    };
});
