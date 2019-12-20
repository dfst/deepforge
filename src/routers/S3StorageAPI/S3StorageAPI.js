/*globals define*/
'use strict';

const express = require('express'),
    router = express.Router(),
    bodyParser = require('body-parser'),
    Minio = require('minio');

function initialize(middlewareOpts) {
    const logger = middlewareOpts.logger.fork('S3StorageAPI'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated;
    let client;

    logger.debug('initializing ...');

    router.use(bodyParser.json());

    router.use('*', function (req, res, next) {
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    // Use ensureAuthenticated if the routes require authentication. (Can be set explicitly for each route.)
    router.use('*', ensureAuthenticated);

    router.post('/presignedUrl', async function (req, res) {
        let generatedURL;
        try {
            client = new Minio.Client(req.body.config);
            generatedURL = await client.presignedUrl(req.body.httpMethod,
                req.body.bucketName,
                req.body.path);
        } catch (error) {
            return res.status(500).json({error});
        }
        logger.debug(`URL ${generatedURL}, generated to ${req.body.httpMethod} the Object ${req.body.path}`);
        return res.json({
            queryURL: generatedURL,
            httpMethod: req.body.httpMethod,
            expiry: 24 * 60 * 60,   // Should this be controlled by ImportArtifact?
        });
    });

    router.post('/statObject', async function (req, res) {
        let stat;
        try {
            client = new Minio.Client(req.body.config);
            stat = await client.statObject(req.body.bucketName, req.body.path);
        } catch (error) {
            return res.status(500).json({error});
        }
        return res.json(stat);
    });

    router.post('/createBucket', async function (req, res) {
        let resObj = {};
        let exists;
        try {
            client = new Minio.Client(req.body.config);
            exists = await client.bucketExists(req.body.bucketName);
        } catch (error) {
            return res.status(500).json({error});
        }
        resObj.alreadyExists = true;
        if (!exists) {
            logger.debug(`Bucket ${req.body.bucketName} doesn't exist. Creating...`);
            try {
                await client.makeBucket(req.body.bucketName);
            } catch (error) {
                return res.status(500).json({error});
            }
            resObj.alreadyExists = false;
        }
        res.json(resObj);
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
