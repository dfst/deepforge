function getSciServerUsername() {
    return process.env.SCISERVER_USERNAME || 'deepforge';
}

function getSciServerPassword() {
    return process.env.SCISERVER_PASSWORD;
}

module.exports = {getSciServerPassword, getSciServerUsername};
