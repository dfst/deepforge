/*globals define*/
define([
    'text!./start.js',
    'text!./run-debug.js',
    'text!./main.ejs',
    'text!./deepforge.ejs',
    'text!./backend_deepforge.py',
    'text!./deepforge__init__.py',
    'text!./serialize.ejs',
    'text!./deserialize.ejs',
    'text!./utils.build.js',
    'text!./environment.worker.yml',
], function(
    START,
    RUN_DEBUG,
    MAIN,
    DEEPFORGE_SERIALIZATION,
    MATPLOTLIB_BACKEND,
    DEEPFORGE_INIT,
    SERIALIZE,
    DESERIALIZE,
    UTILS,
    WORKER_ENV,
) {

    return {
        START,
        RUN_DEBUG,
        MAIN,
        SERIALIZE,
        DEEPFORGE_SERIALIZATION,
        MATPLOTLIB_BACKEND,
        DEEPFORGE_INIT,
        DESERIALIZE,
        UTILS,
        WORKER_ENV,
    };
});
