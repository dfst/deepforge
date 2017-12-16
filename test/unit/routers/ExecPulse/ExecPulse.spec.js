/*jshint node:true, mocha:true*/
describe('ExecPulse', function() {
    var testFixture = require('../../../globals'),
        PULSE = require('../../../../src/common/Constants').PULSE,
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        gmeConfig = testFixture.getGmeConfig(),
        server = testFixture.WebGME.standaloneServer(gmeConfig),
        mntPt = require('../../../../webgme-setup.json').components.routers.ExecPulse.mount,
        urlFor = function(action) {
            return [
                server.getUrl(),
                mntPt,
                action
            ].join('/');
        },
        HASH_COUNT = 1,
        getHash = function() {
            return `jobhash_${HASH_COUNT++}`;
        };

    before(function(done) {
        server.start(done);
    });

    after(function(done) {
        server.stop(done);
    });

    it('should record heartbeat', function(done) {
        var hash = getHash();
        superagent.post(urlFor(hash))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(201);
                done();
            });
    });

    it('should delete /:jobHash', function(done) {
        var hash = getHash();
        superagent.delete(urlFor(hash))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(204);
                done();
            });
    });

    // Check if job is still running
    it('should check that the job is running', function(done) {
        var hash = getHash();
        superagent.post(urlFor(hash))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(201);
                superagent.get(urlFor(hash)).end((err, res) => {
                    expect(res.text).to.equal(PULSE.ALIVE.toString());
                    done();
                });
            });
    });

    it('should not report running after deletion', function(done) {
        var hash = getHash();
        superagent.post(urlFor(hash))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(201);
                superagent.delete(urlFor(hash)).end(() => {
                    superagent.get(urlFor(hash)).end((err, res) => {
                        expect(res.text).to.equal(PULSE.DOESNT_EXIST.toString());
                        done();
                    });
                });
            });
    });
});
