/* globals define */
define([
    '../BaseBackend'
], function(
    BaseBackend
) {

    const GMEBackend = function() {
        BaseBackend.call(this, 'GME');
    };

    GMEBackend.prototype = Object.create(BaseBackend.prototype);

    return GMEBackend;
});
