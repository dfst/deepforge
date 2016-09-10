/* globals define */
define({
    LINE_OFFSET: 'lineOffset',

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
    GRAPH_PLOT: 'PLOT',
    GRAPH_CREATE_LINE: 'LINE',

    // Code Generation Constants
    CTOR_ARGS_ATTR: 'ctor_arg_order',

    // Operation types
    OP: {
        INPUT: 'Input',
        OUTPUT: 'Output'
    },

    // Job stdout update
    STDOUT_UPDATE: 'stdout_update'
});
