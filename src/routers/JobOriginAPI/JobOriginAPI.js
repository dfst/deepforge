/*jshint node:true*/

'use strict';

var express = require('express'),
    MONGO_COLLECTION = 'JobOrigins',
    utils = require('../utils'),
    mongo,
    router = express.Router(),
    storage;

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
// When testing, use in memory storage...
function initialize(middlewareOpts) {
    var logger = middlewareOpts.logger.fork('JobOriginAPI'),
        gmeConfig = middlewareOpts.gmeConfig,
        ensureAuthenticated = middlewareOpts.ensureAuthenticated,
        REQUIRED_FIELDS = ['hash', 'project', 'execution', 'job', 'nodeId', 'branch'];

    storage = require('../storage')(logger, gmeConfig);

    logger.debug('initializing ...');
    // Ensure authenticated can be used only after this rule.
    router.use('*', function (req, res, next) {
        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    // Connect to mongo...

    router.get('/', function (req, res) {
        mongo.find().toArray((err, all) => {
            if (err) {
                return res.status(500).send(err);
            }
            res.json(all.map(entry => {
                delete entry._id;
                return entry;
            }));
        });
    });

    router.get('/:jobHash', function (req, res/*, next*/) {
        var hash = req.params.jobHash,
            jobInfo = {};

        mongo.findOne({hash: hash})
            .then(result => {
                if (result) {
                    // Filter the result object
                    for (var i = REQUIRED_FIELDS.length; i--;) {
                        jobInfo[REQUIRED_FIELDS[i]] = result[REQUIRED_FIELDS[i]];
                    }
                    return res.json(jobInfo);
                }
                res.sendStatus(404);
            })
            .catch(err => {
                logger.error(`Storing job info failed: ${err}`);
                res.status(500).send(err);
            });
    });

    router.post('/:jobHash', function (req, res/*, next*/) {
        var hash = req.params.jobHash,
            jobInfo = {
                hash: hash,
                project: req.body.project,
                execution: req.body.execution,
                branch: req.body.branch,
                job: req.body.job,  // job name
                nodeId: req.body.nodeId
            };

        // Check that none of the fields are undefined
        var missing = utils.getMissingField(jobInfo, REQUIRED_FIELDS);
        if (missing) {
            return res.status(400).send(`Missing required field: ${missing}`);
        }

        logger.debug(`Storing job info for ${hash}`);
        return mongo.insertOne(jobInfo)
            .then(() => res.sendStatus(201))
            .catch(err => {
                logger.error(`Storing job info failed: ${err}`);
                res.status(500).send(err.toString());
            });
    });

    router.delete('/:jobHash', function (req, res/*, next*/) {
        var hash = req.params.jobHash;

        mongo.findOneAndDelete({hash: hash})
            .then(() => res.sendStatus(204));
    });

    // on fork
    router.patch('/:jobHash', function (req, res) {
        var hash = req.params.jobHash;

        if (!req.body.branch) {
            return res.status(400).send('Missing "branch" field');
        }

        return mongo.findOneAndUpdate({hash: hash}, {$set: {branch: req.body.branch}})
            .then(() => {
                logger.debug('Finished updateOne!');
                res.sendStatus(200);
            })
            .catch(err => {
                logger.error(`Job update failed: ${err}`);
                res.status(500).send(err);
            });
    });

    logger.debug('ready');
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    storage.then(db => {
        mongo = db.collection(MONGO_COLLECTION);
        callback();
    });

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
