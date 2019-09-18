/* globals define */
define([
    '../ComputeBackend',
], function(
    ComputeBackend,
) {

    const GMEBackend = function() {
        ComputeBackend.call(this, 'GME');
    };

    GMEBackend.prototype = Object.create(ComputeBackend.prototype);

    GMEBackend.prototype.getDashboard = async function() {
        console.log(this, this.require);
        return await this.require('deepforge/compute/backends/gme/dashboard/index');
    };

    return GMEBackend;
});
