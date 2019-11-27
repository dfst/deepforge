/*globals define*/
define([
    'text!./start.js',
    'text!./main.ejs',
    'text!./deepforge.ejs',
    'text!./backend_deepforge.py',
    'text!./deepforge__init__.py',
    'text!./serialize.ejs',
    'text!./deserialize.ejs',
    'text!./utils.build.js',
], function(
    START,
    MAIN,
    DEEPFORGE_SERIALIZATION,
    MATPLOTLIB_BACKEND,
    DEEPFORGE_INIT,
    SERIALIZE,
    DESERIALIZE,
    UTILS,
) {

    return {
        START,
        MAIN,
        SERIALIZE,
        DEEPFORGE_SERIALIZATION,
        MATPLOTLIB_BACKEND,
        DEEPFORGE_INIT,
        DESERIALIZE,
        UTILS,
    };
});
