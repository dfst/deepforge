/*globals define*/
define([
    'text!./nn.json',
    'text!./rnn.json'
], function(
    nn,
    rnn
) {
    return {
        nn: nn,
        rnn: rnn
    };
});