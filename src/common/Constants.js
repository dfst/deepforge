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
    return {
        CONTAINED_LAYER_SET: 'addLayers',
        CONTAINED_LAYER_INDEX: 'index',

        LINE_OFFSET: 'lineOffset',
        DISPLAY_COLOR: 'displayColor',

        // DeepForge metadata creation in dist execution
        START_CMD: 'deepforge-cmd',

        IMAGE: {  // all prefixed w/ 'IMG' for simple upload detection
            PREFIX: 'IMG',
            BASIC: 'IMG-B',
            CREATE: 'IMG-C',
            UPDATE: 'IMG-U',
            NAME: 'IMAGE-N'  // No upload required
        },

        GRAPH_CREATE: 'GRAPH',
        PLOT_UPDATE: 'PLOT',
        GRAPH_PLOT: 'PLOT',
        GRAPH_CREATE_LINE: 'LINE',
        GRAPH_LABEL_AXIS: {
            X: 'X',
            Y: 'Y'
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
}));
