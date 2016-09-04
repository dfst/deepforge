/*jshint node:true*/

'use strict';

var express = require('express'),
    JobLogManager = require('./JobLogManager'),
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
    var logger = middlewareOpts.logger.fork('JobLogsAPI'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated,
        gmeConfig = middlewareOpts.gmeConfig,
        logManager = new JobLogManager(logger, gmeConfig);

    logger.debug('initializing ...');

    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    router.get('/:project/:branch/:job', function (req, res/*, next*/) {
        // Retrieve the job logs for the given job
        logManager.getLog(req.params).then(log => {
            res.set('Content-Type', 'text/plain');
            res.send(log);
        });
    });

    router.patch('/:project/:branch/:job', function (req, res/*, next*/) {
        var logs = req.body.patch;
        logger.info(`Received append request for ${req.params.job} in ${req.params.project}`);
        logManager.appendTo(req.params, logs)
            .then(() => res.send('Append successful'))
            .catch(err => logger.error(`Append failed: ${err}`));
    });

    router.delete('/:project/:branch/:job', function (req, res/*, next*/) {
        logManager.delete(req.params).then(() => res.send('delete successful'));
    });

    router.post('/migrate/:project/:srcBranch/:dstBranch', function (req, res/*, next*/) {
        var jobs = req.body.jobs;
        logManager.migrate(req.params, jobs)
            .then(() => res.send('migration successful'))
            .fail(err => logger.error(err));
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
