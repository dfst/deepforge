/* globals define */
// Connection with port support
define([
    'widgets/EasyDAG/Connection',
    'underscore'
], function(
    EasyDAGConn,
    _
) {
    'use strict';

    var Connection = function() {
        EasyDAGConn.apply(this, arguments);
        this.srcPort = this.desc.srcPort;
        this.dstPort = this.desc.dstPort;
    };

    _.extend(Connection.prototype, EasyDAGConn.prototype);

    return Connection;
});
