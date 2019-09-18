/* globals define */
define([
    './dashboard/index',
    '../BaseBackend'
], function(
    Dashboard,
    BaseBackend
) {

    const GMEBackend = function() {
        BaseBackend.call(this, 'GME');
    };

    GMEBackend.prototype = Object.create(BaseBackend.prototype);

    GMEBackend.prototype.getDashboard = function() {
        return Dashboard;
    };

    return GMEBackend;
});
