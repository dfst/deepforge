'use strict';

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const TokenStorage = require('./Tokens');
let gmeConfig;
let storage;

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
    gmeConfig = middlewareOpts.gmeConfig;
    const getUserId = req => {
        return middlewareOpts.getUserId(req) || gmeConfig.authentication.guestAccount;
    };
    const logger = middlewareOpts.logger.fork('SciServerAuth');
    storage = require('../storage')(logger, gmeConfig);

    logger.debug('initializing ...');

    router.get('/register', async function (req, res) {
        const {token} = req.query;
        const userId = getUserId(req);
        try {
            const name = await getUsername(token);
            await TokenStorage.register(userId, name, token);
            res.status(200).send(`SciServer account "${name}" is now accessible from DeepForge for the next 24 hours.`);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    router.get('/', async function (req, res) {
        const userId = getUserId(req);
        const names = await TokenStorage.getUsernames(userId);
        return res.json(names);
    });

    router.get('/:name/token', async function (req, res) {
        const userId = getUserId(req);
        const {name} = req.params;
        try {
            return res.send(await TokenStorage.getToken(userId, name));
        } catch (err) {
            const statusCode = err instanceof TokenStorage.NotFoundError ? 404 : 500;
            return res.status(statusCode).send(err.message);
        }
    });

    logger.debug('ready');
}

async function getUsername(token) {
    const url = `https://apps.sciserver.org/login-portal/keystone/v3/tokens/${token}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.token.user.name;
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
async function start(callback) {
    const db = await storage;
    TokenStorage.init(gmeConfig, db);
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
