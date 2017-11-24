var testFixture = require('../../../globals'),
    superagent = testFixture.superagent,
    Q = testFixture.Q,
    expect = testFixture.expect,
    assert = require('assert'),
    path = testFixture.path,
    gmeConfig = testFixture.getGmeConfig(),
    blobDir = gmeConfig.blob.fsDir,
    server = testFixture.WebGME.standaloneServer(gmeConfig),
    mntPt = 'execution/logs',
    rm_rf = require('rimraf'),
    exists = require('exists-file');

describe('JobLogsAPI', function() {
    var project = 'testProject',
        branch = 'master',
        jobId = encodeURIComponent('/4/q/l'),
        firstLog = 'hello world',
        url = [
            server.getUrl(),
            mntPt,
            project,
            branch,
            jobId
        ].join('/');

    before(function(done) {
        testFixture.mkdir(blobDir);
        server.start(done);
    });

    after(function(done) {
        rm_rf.sync(blobDir);
        server.stop(done);
    });

    describe('appendTo', function() {

        before(function(done) {
            superagent.patch(url)
                .send({patch: firstLog})
                .end(function (err, res) {
                    expect(res.status).equal(200, err);
                    done();
                });
        });

        it('should create job-logs directory', function() {
            assert(exists.sync(path.join(blobDir, 'log-storage')));
        });

        describe('getLog', function() {
            it('should return the logs from the job', function(done) {
                superagent.get(url)
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        expect(res.text).to.contain(firstLog);
                        done();
                    });
            });

            it('should append additional logs to the file', function(done) {
                var secondLog = 'goodbye world';
                superagent.patch(url)
                    .send({patch: secondLog})
                    .end(function (err, res) {
                        expect(res.status).equal(200, err);
                        superagent.get(url)
                            .end(function (err, res) {
                                expect(res.status).equal(200, err);
                                expect(res.text).to.contain(secondLog);
                                done();
                            });
                    });
            });

        });
    });

    describe('delete', function() {
        var delUrl = [
            server.getUrl(),
            mntPt,
            'testProject',
            'other',
            encodeURIComponent('/4/8/l')
        ].join('/');

        before(function(done) {
            superagent.patch(delUrl)
                .send({patch: firstLog})
                .end(function (err, res) {
                    expect(res.status).equal(200, err);
                    done();
                });
        });

        it('should delete the file from job-logs directory', function(done) {
            superagent.delete(delUrl)
                .end(function (err, res) {
                    expect(res.status).equal(204, err);
                    superagent.get(delUrl)
                        .end(function (err, res) {
                            expect(res.status).equal(200, err);
                            expect(res.text).to.equal('');
                            done();
                        });
                });
        });
    });

    function getUrl(project, branch, job) {
        return [
            server.getUrl(),
            mntPt,
            encodeURIComponent(project),
            encodeURIComponent(branch),
            encodeURIComponent(job)
        ].join('/');
    }

    function addLog(project, branch, job, log) {
        var deferred = Q.defer();

        console.log('adding log', log);
        superagent.patch(getUrl(project, branch, job))
            .send({patch: log})
            .end(function (err, res) {
                if (err) {
                    return deferred.reject(err + ' (' + job + ')');
                }
                return deferred.resolve(res);
            });
            
        return deferred.promise;
    }

    describe('migrate', function() {
        var j1 = '/s/p/3',
            j2 = '/1/d/4',
            b1 = 'asdfmaster',
            b2 = 'not-master',
            proj = 'someProject',
            j1log = 'I am ' + j1,
            j2log = 'I am ' + j2,
            url;

        before(function(done) {
            Q.all([
                addLog(proj, b1, j1, j1log),
                addLog(proj, b1, j2, j2log),
                addLog(proj, b2, j2, 'otherStuff')
            ]).then(() => {
                url = [
                    server.getUrl(),
                    mntPt + '/migrate',
                    encodeURIComponent(proj),
                    encodeURIComponent(b1),
                    encodeURIComponent(b2)
                ].join('/');
                superagent.post(url)
                    .send({jobs: [j1]})
                    .end(err => done(err));
            })
            .catch(err => done(err));

        });

        it('should copy the log content to the new branch', function(done) {
            url = getUrl(proj, b2, j1);
            superagent.get(url)
                .end((err, res) => {
                    expect(res.text).to.equal(j1log);
                    done(err);
                });
        });

        it('should not copy other jobs', function(done) {
            url = getUrl(proj, b2, j2);
            superagent.get(url)
                .end((err, res) => {
                    // This log shouldn't be updated
                    expect(res.text).to.not.equal(j2log);
                    done(err);
                });
        });

        it('should not change original log', function(done) {
            url = getUrl(proj, b1, j1);
            superagent.get(url)
                .end((err, res) => {
                    expect(res.text).to.equal(j1log);
                    done(err);
                });
        });

        it('should not crash on bad request', function(done) {
            url = [
                server.getUrl(),
                mntPt + '/migrate',
                encodeURIComponent(proj),
                encodeURIComponent('someBranch3'),
                encodeURIComponent(b2)
            ].join('/');
            superagent.post(url)
                .send({jobs: [j1]})
                .end(err => done(err));
        });
    });

});
