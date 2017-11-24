const testFixture = require('../globals');
const gmeConfig = testFixture.getGmeConfig();
const BASE_URL = `http://localhost:${gmeConfig.server.port}`;
const getUrl = function(project, nodeId, branch) {
    branch = branch || 'master';
    nodeId = nodeId || '/f';

    nodeId = encodeURIComponent(nodeId);
    return `${BASE_URL}?project=guest%2B${project}&branch=${branch}&node=${nodeId}`;
};

module.exports = {
    getUrl: getUrl
};
