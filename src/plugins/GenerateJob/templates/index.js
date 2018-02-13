/*globals define*/
define([
    'text!./start.ejs',
    'text!./main.ejs',
    'text!./deepforge.ejs',
    'text!./backend_deepforge.py',
    'text!./deepforge__init__.py',
    'text!./serialize.ejs',
    'text!./deserialize.ejs'
], function(
    START,
    MAIN,
    DEEPFORGE_SERIALIZATION,
    MATPLOTLIB_BACKEND,
    DEEPFORGE_INIT,
    SERIALIZE,
    DESERIALIZE
) {

    return {
        START,
        MAIN,
        SERIALIZE,
        DEEPFORGE_SERIALIZATION,
        MATPLOTLIB_BACKEND,
        DEEPFORGE_INIT,
        DESERIALIZE
    };
});
