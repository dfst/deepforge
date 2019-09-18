/* globals define */
define([
    '../ComputeBackend'
], function(
    ComputeBackend
) {

    const LocalBackend = function() {
        ComputeBackend.call(this, 'Local');
    };

    LocalBackend.prototype = Object.create(ComputeBackend.prototype);

    return LocalBackend;
});
