/* globals define */
define([
    './APIClient'
], function(
    APIClient
) {
    'use strict';

    var ExecPulseClient = function(params) {
        this.relativeUrl = '/execution/pulse/';
        this.logger = params.logger.fork('ExecPulseClient');
        APIClient.call(this, params);
    };

    ExecPulseClient.prototype = Object.create(APIClient.prototype);

    ExecPulseClient.prototype.getUrl = function(hash) {
        return this.url + hash;
    };

    // - update the heartbeat
    // - check the heartbeat
    // - delete the heartbeat
    ExecPulseClient.prototype.update = function(hash) {
        return this._request('post', hash)
            .catch(err => {
                throw err.text || err;
            });
    };

    ExecPulseClient.prototype.check = function(hash) {
        return this._request('get', hash)
            .then(res => JSON.parse(res.text))
            .catch(err => {
                throw err.text || err;
            });
    };

    ExecPulseClient.prototype.clear = function(hash) {
        return this._request('delete', hash);
    };

    return ExecPulseClient;
});
