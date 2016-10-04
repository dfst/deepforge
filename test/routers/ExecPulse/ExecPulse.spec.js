/*jshint node:true, mocha:true*/
describe.only('ExecPulse', function() {
    var testFixture = require('../../globals'),  // TODO: May need to change this if not created from webgme-cli
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        gmeConfig = testFixture.getGmeConfig(),
        server = testFixture.WebGME.standaloneServer(gmeConfig),
        mntPt = require('../../../webgme-setup.json').components.routers.ExecPulse.mount,
        urlFor = function(action) {
            return [
                server.getUrl(),
                mntPt,
                action
            ].join('/');
        },
        HASH_COUNT = 1,
        getJob = function() {
            var id = `jobhash_${HASH_COUNT++}`;
            return {
                hash: id,
                nodeId: `/a/b/${HASH_COUNT}`,
                project: 'guest+hello',
                branch: 'master'
            };
        };

    before(function(done) {
        server.start(done);
    });

    after(function(done) {
        server.stop(done);
    });

    it('should record heartbeat', function(done) {
        var job = getJob();
        superagent.post(urlFor(job.hash))
            .send(job)
            .end(function(err, res) {
                expect(res.statusCode).to.equal(201);
                done();
            });
    });

    it('should delete /:jobHash', function(done) {
        var job = getJob();
        superagent.delete(urlFor(job.hash))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(204);
                done();
            });
    });

    // Check if job is still running
    // TODO

    // Update timestamp on heartbeat
    // TODO
});
