/*globals define */
// This is a mixin containing helpers for working with operation nodes
define([],function() {

    var OperationOps = function() {
    };

    OperationOps.prototype.getOutputs = function (node) {
        return this.getOperationData(node, this.META.Outputs);
    };

    OperationOps.prototype.getInputs = function (node) {
        return this.getOperationData(node, this.META.Inputs);
    };

    OperationOps.prototype.getOperationData = function (node, metaType) {
        // Load the children and the output's children
        return this.core.loadChildren(node)
            .then(containers => {
                var outputs = containers.find(c => this.core.isTypeOf(c, metaType));
                return outputs ? this.core.loadChildren(outputs) : [];
            })
            .then(outputs => {
                var bases = outputs.map(node => this.core.getMetaType(node));
                // return [[arg1, Type1, node1], [arg2, Type2, node2]]
                return outputs.map((node, i) => [
                    this.getAttribute(node, 'name'),
                    this.getAttribute(bases[i], 'name'),
                    node
                ]);
            });
    };

    return OperationOps;
});
