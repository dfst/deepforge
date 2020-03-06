/* globals define */
define([
], function(
) {
    class Metadata {
        constructor(node, core, META) {
            this.node = node;
            this.core = core;
            this.META = META;
        }

        async update(/*content*/) {
            throw new Error('not implemented!');
        }

        static getCommand() {
            throw new Error('not implemented!');
        }

        static getMetaType() {
            throw new Error('not implemented!');
        }
    }


    return Metadata;
});
