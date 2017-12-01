/* globals browser */
const testFixture = require('../globals');
const gmeConfig = testFixture.getGmeConfig();
const BASE_URL = `http://localhost:${gmeConfig.server.port}`;
const getUrl = function(project, nodeId, branch) {
    branch = branch || 'master';
    nodeId = nodeId || '/f';

    nodeId = encodeURIComponent(nodeId);
    return `${BASE_URL}?project=guest%2B${project}&branch=${branch}&node=${nodeId}`;
};

// sleep function
const sleep = duration => {
    let endTime = Date.now() + duration;
    browser.waitUntil(function() {
        return endTime <= Date.now();
    }, 2*duration, 'Expected attribute to be removed within 1.5s');
};

module.exports = {
    sleep,
    getUrl
};
