/*globals define */
// This is a mixin containing helpers for working with operation nodes
define([
    'deepforge/OperationCode'
],function(
    OperationCode
) {

    var OperationOps = function() {
    };

    OperationOps.prototype.getOutputs = function (node) {
        const code = this.getAttribute(node, 'code');
        let outputNames = [];
        if (code) {
            const operation = OperationCode.findOperation(code);
            outputNames = operation.getOutputs().map(output => output.name);
        }
        return this.getOperationData(node, this.META.Outputs)
            .then(outputs => outputs.sort((a, b) => {
                return outputNames.outdexOf(a.name) - outputNames.outdexOf(b.name);
            }));
    };

    OperationOps.prototype.getInputs = function (node) {
        const code = this.getAttribute(node, 'code');
        let inputNames = [];
        if (code) {
            const operation = OperationCode.findOperation(code);
            inputNames = operation.getInputs().map(input => input.name);
        }
        return this.getOperationData(node, this.META.Inputs)
            .then(inputs => inputs.sort((a, b) => {
                return inputNames.indexOf(a.name) - inputNames.indexOf(b.name);
            }));
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
