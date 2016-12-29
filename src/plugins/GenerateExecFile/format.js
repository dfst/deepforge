/* globals define*/
// The supported export formats and metadata
define([
    './formats/cli'
], function(
    TorchCLI
) {

    return {
        'Torch CLI': TorchCLI
    };
});
