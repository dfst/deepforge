/* globals define */
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define([], function(){
            return factory();
        });
    } else if(typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CONSTANTS = factory();
    }
}(this, function() {
    const Constants = {
        CONTAINED_LAYER_SET: 'addLayers',
        CONTAINED_LAYER_INDEX: 'index',

        OPERATION: {
            LINE_OFFSET: 'lineOffset',
            DISPLAY_COLOR: 'displayColor',
            ENV: 'condaEnv',
        },

        // DeepForge metadata creation in dist execution
        START_CMD: 'deepforge-cmd',

        IMAGE: {  // all prefixed w/ 'IMG' for simple upload detection
            PREFIX: 'IMG',
            BASIC: 'IMG-B',
            CREATE: 'IMG-C',
            UPDATE: 'IMG-U',
            NAME: 'IMAGE-N'  // No upload required
        },

        // Code Generation Constants
        CTOR_ARGS_ATTR: 'ctor_arg_order',

        // Operation types
        OP: {
            INPUT: 'Input',
            OUTPUT: 'Output'
        },

        // Heartbeat constants (ExecPulse router)
        PULSE: {
            DEAD: 0,
            ALIVE: 1,
            DOESNT_EXIST: 2
        },

        // Job stdout update
        STDOUT_UPDATE: 'stdout_update'
    };
    Constants.OPERATION.RESERVED_ATTRS = Object.values(Constants.OPERATION)
        .concat(['name', 'code']);

    return Constants;
}));
