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

        async loadChildren() {
            const provPath = this.core.getPointerPath(this.node, 'provenance');
            const children = (await this.core.loadChildren(this.node))
                .filter(node => this.core.getPath(node) !== provPath);

            return children;
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
