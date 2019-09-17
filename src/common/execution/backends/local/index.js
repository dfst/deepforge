/* globals define */
define([
    '../BaseBackend'
], function(
    BaseBackend
) {

    const LocalBackend = function() {
        BaseBackend.call(this, 'Local');
    };

    LocalBackend.prototype = Object.create(BaseBackend.prototype);

    return LocalBackend;
});
