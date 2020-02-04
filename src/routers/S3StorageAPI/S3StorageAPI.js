/* eslint-env node */
'use strict';

const express = require('express'),
    router = express.Router(),
    bodyParser = require('body-parser'),
    Minio = require('minio');

function initialize(middlewareOpts) {
    const logger = middlewareOpts.logger.fork('S3StorageAPI'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated;

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
            const client = new Minio.Client(req.body.config);
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
            expiry: 24 * 60 * 60 * 7,
        });
    });

    router.post('/statObject', async function (req, res) {
        let stat;
        try {
            const client = new Minio.Client(req.body.config);
            stat = await client.statObject(req.body.bucketName, req.body.path);
        } catch (error) {
            return res.status(500).json({error});
        }
        return res.json(stat);
    });

    router.post('/createBucket', async function (req, res) {
        let client,
            resObj = {
                alreadyExists: true
            };
        try {
             client = new Minio.Client(req.body.config);
            resObj.alreadyExists = await client.bucketExists(req.body.bucketName);
        } catch (error) {
            return res.status(500).json({error});
        }
        if (!resObj.alreadyExists) {
            logger.debug(`Bucket ${req.body.bucketName} doesn't exist. Creating...`);
            try {
                await client.makeBucket(req.body.bucketName);
            } catch (error) {
                return res.status(500).json({error});
            }
            resObj.alreadyExists = false;
        }
        return res.status(200).json(resObj);
    });

    router.post('/listObjects', async function (req, res) {
        let resObj = {
            objects: []
        };
        let exists, client;
        try {
            client = new Minio.Client(req.body.config);
            exists = await client.bucketExists(req.body.bucketName);
        } catch (error) {
            return res.status(500).json({error});
        }
        if(!exists){
            resObj.count = 0;
            return res.status(200).json(resObj);
        }
        let objectsStream = client.listObjectsV2(req.body.bucketName, req.body.path, req.body.recursive);
        let count = 0;

        objectsStream.on('data', async function (obj) {
            resObj.objects.push(obj.name);
            count++;
        });

        objectsStream.on('error', function (error) {
            return res.status(500).json({error});
        });

        objectsStream.on('end', async function () {
            resObj.count = count;
            return res.status(200).json(resObj);
        });
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
