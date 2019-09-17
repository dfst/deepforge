/* globals define, requirejs */
define([
    'module'
], function(
    module
) {

    const BaseBackend = function(name) {
        console.log(`Creating backend: ${name}`);
        this.name = name;
    };

    BaseBackend.prototype.getClient = function(logger) {
        const path = require('path');
        const dirname = path.dirname(module.uri);
        const Client = requirejs(`${dirname}/${this.name.toLowerCase()}/Client.js`);
        return new Client(logger);
    };

    BaseBackend.prototype.getOptions = function() {
        return [];
    };

    BaseBackend.prototype.getDashboard = function() {
        return null;
    };

    return BaseBackend;
});
