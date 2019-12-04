const fetch = require('node-fetch');

function getSciServerUsername() {
    return process.env.SCISERVER_USERNAME || 'deepforge';
}

async function getSciServerToken() {
    const url = 'https://apps.sciserver.org/login-portal/keystone/v3/tokens';
    const name = getSciServerUsername();
    const password = process.env.SCISERVER_PASSWORD;
    const headers = new fetch.Headers();
    headers.append('Content-Type', 'application/json');
    const opts = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            auth: {
                identity: {
                    password: {
                        user: {name,password},
                    }
                }
            }
        }),
    };
    const response = await fetch(url, opts);
    if (response.status === 401) {
        throw new Error('Invalid username or password for SciServerFiles');
    }
    return response.headers.get('X-Subject-Token');
}

module.exports = {getSciServerToken, getSciServerUsername};
