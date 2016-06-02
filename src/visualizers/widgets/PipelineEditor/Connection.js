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

    Connection.prototype.setStartPoint = function(point) {
        // Update 'this.points' to start at the given point
        this.points[0] = point;
    };

    Connection.prototype.setEndPoint = function(point) {
        // Update 'this.points' to end at the given point
        var last = this.points.length-1;
        this.points[last] = point;
    };

    return Connection;
});
