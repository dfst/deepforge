const TokenStorage = require('../../../src/routers/SciServerAuth/Tokens');
const fetch = require('node-fetch');
const Headers = fetch.Headers;

function getSciServerUsername() {
    return process.env.SCISERVER_USERNAME || 'deepforge';
}

function getSciServerPassword() {
    return process.env.SCISERVER_PASSWORD;
}

async function getToken(username, password) {
    const LOGIN_URL = 'https://apps.sciserver.org/login-portal/keystone/v3/tokens';
    const url = `${LOGIN_URL}?TaskName=DeepForge.Authentication.Login`;
    const opts = {
        method: 'POST',
        headers: new Headers({
            'Content-Type': 'application/json'
        }),
        body: getLoginBody(username, password)
    };
    const response = await fetch(url, opts);
    return response.headers.get('X-Subject-Token');
}

async function login(username, password) {
    const token = await getToken(username, password);
    await TokenStorage.register(undefined, username, token);
    return token;
}

function getLoginBody(username, password) {
    return JSON.stringify({
        auth: {
            identity: {
                password: {
                    user: {
                        name: username,
                        password: password
                    }
                }
            }
        }
    });
}

module.exports = {getSciServerPassword, getSciServerUsername, login};
