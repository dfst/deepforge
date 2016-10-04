/*jshint node:true*/

// This is a REST endpoint keeping track of the heartbeats of each execution. This
// allows detection of "disconnected" executions (enabling the reconnection of the
// executions - issue #821)
'use strict';

var express = require('express'),
    MONGO_COLLECTION = 'ExecPulse',
    utils = require('../utils'),
    router = express.Router();

/**
 * Called when the server is created but before it starts to listening to incoming requests.
 * N.B. gmeAuth, safeStorage and workerManager are not ready to use until the start function is called.
 * (However inside an incoming request they are all ensured to have been initialized.)
 *
 * @param {object} middlewareOpts - Passed by the webgme server.
 * @param {GmeConfig} middlewareOpts.gmeConfig - GME config parameters.
 * @param {GmeLogger} middlewareOpts.logger - logger
 * @param {function} middlewareOpts.ensureAuthenticated - Ensures the user is authenticated.
 * @param {function} middlewareOpts.getUserId - If authenticated retrieves the userId from the request.
 * @param {object} middlewareOpts.gmeAuth - Authorization module.
 * @param {object} middlewareOpts.safeStorage - Accesses the storage and emits events (PROJECT_CREATED, COMMIT..).
 * @param {object} middlewareOpts.workerManager - Spawns and keeps track of "worker" sub-processes.
 */
function initialize(middlewareOpts) {
    var logger = middlewareOpts.logger.fork('ExecPulse'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated,
        storage = require('../storage')(middlewareOpts.gmeConfig),
        REQUIRED_FIELDS = ['hash', 'project', 'nodeId', 'branch', 'timestamp'],
        STALE_THRESHOLD = 5000,
        mongo;

    logger.debug('initializing ...');
    storage.then(db => mongo = db.collection(MONGO_COLLECTION));

    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    router.get('/running', function (req, res) {
        var params = req.body;
        // Check if the given job has a stale heartbeat
        // Searching just w/ jobHash works for ExecuteJob but
        // will not work for ExecutePipeline...
        if (!req.body.hash) {
            // Must have project, branch and nodeId
            var missing = utils.getMissingField(params, ['project', 'branch', 'nodeId']);
            if (!missing) {
                return res.status(400).send(`Missing required field: ${missing} (or hash)`);
            }
        }

        mongo.findOne(params)
            .then(job => {
                var current = Date.now();
                if (job) {
                    return res.send((current - job.timestamp) > STALE_THRESHOLD);
                }
                return res.sendStatus(404);
            });
    });

    router.post('/:jobHash', function (req, res) {
        var timestamp = Date.now(),
            job = {
                hash: req.params.jobHash,
                project: req.body.project,
                branch: req.body.branch,
                nodeId: req.body.nodeId,
                timestamp: timestamp
            };

        // Validate the input
        var missing = utils.getMissingField(job, REQUIRED_FIELDS);
        if (missing) {
            return res.status(400).send(`Missing required field: ${missing}`);
        }

        // Delete the given job from the database
        mongo.update({hash: job.hash}, job, {upsert: true})
            .then(() => res.sendStatus(204));
    });

    router.delete('/:jobHash', function (req, res/*, next*/) {
        // Delete the given job from the database
        return mongo.findOneAndDelete({hash: req.params.jobHash})
            .then(() => res.sendStatus(204));
    });

    logger.debug('ready');
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    callback();
}

/**
 * Called after the server stopped listening.
 * @param {function} callback
 */
function stop(callback) {
    callback();
}


module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};
