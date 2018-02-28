var testFixture = require('../../../globals'),
    superagent = testFixture.superagent,
    expect = testFixture.expect,
    gmeConfig = testFixture.getGmeConfig(),
    server = testFixture.WebGME.standaloneServer(gmeConfig),
    mntPt = 'job/origins';

describe('JobOriginAPI', function() {
    var hashes = {},
        getUrl = function(hash) {
            return [
                server.getUrl(),
                mntPt,
                hash
            ].join('/');
        },
        getJobInfo = function() {
            var hash = 'hash'+Math.ceil(Math.random()*100000);

            while (hashes[hash]) {
                hash = 'hash'+Math.ceil(Math.random()*100000);
            }
            hashes[hash] = true;

            return {
                hash: hash,
                job: 'SomeJob',
                branch: 'master',
                execution: 'train_execution',
                project: 'guest+example',
                nodeId: 'K/6/1'
            };
        };

    before(function(done) {
        server.start(done);
    });

    after(function(done) {
        server.stop(done);
    });

    it('should store job info', function(done) {
        var job = getJobInfo();

        superagent.post(getUrl(job.hash))
            .send(job)
            .end(function (err, res) {
                expect(res.status).equal(201, err);
                done();
            });
    });

    it('should read job info', function(done) {
        var job = getJobInfo(),
            url = getUrl(job.hash);

        superagent.post(url)
            .send(job)
            .end(function (err, res) {
                expect(res.status).equal(201, err);
                superagent.get(url)
                    .end((err, res) => {
                        var jobInfo = JSON.parse(res.text);
                        Object.keys(jobInfo).forEach(key => {
                            expect(jobInfo[key]).equal(job[key]);
                        });
                        done();
                    });
            });
    });

    it('should delete job info', function(done) {
        var job = getJobInfo(),
            url = getUrl(job.hash);

        superagent.post(url)
            .send(job)
            .end(function (err, res) {
                expect(res.status).equal(201, err);
                superagent.delete(url).end(err => {
                    expect(err).equal(null);
                    superagent.get(url)
                        .end((err, res) => {
                            expect(res.status).equal(404, err);
                            done();
                        });
                });
            });
    });

    it('should update job branch', function(done) {
        var job = getJobInfo(),
            url = getUrl(job.hash);

        superagent.post(url)  // create the job
            .send(job)
            .end(function (err, res) {
                expect(res.status).equal(201, err);
                superagent.patch(url)  // update the branch
                    .send({branch: 'newBranch'})
                    .end(err => {
                        expect(err).equal(null);

                        superagent.get(url)  // check the new version
                            .end((err, res) => {
                                var info = JSON.parse(res.text);
                                expect(info.branch).equal('newBranch');
                                expect(res.status).equal(200, err);
                                done();
                            });
                    });
            });
    });
});
