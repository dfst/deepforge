var testFixture = require('../../../globals'),
    expect = testFixture.expect,
    assert = require('assert'),
    path = testFixture.path,
    gmeConfig = testFixture.getGmeConfig(),
    blobDir = gmeConfig.blob.fsDir,
    server = testFixture.WebGME.standaloneServer(gmeConfig),
    Logger = require('webgme-engine/src/server/logger'),
    logger = Logger.createWithGmeConfig('gme', gmeConfig, true),
    JobLogsClient = testFixture.requirejs('deepforge/api/JobLogsClient'),
    rm_rf = require('rimraf'),
    exists = require('exists-file');

describe('JobLogsClient', function() {
    var logClient = new JobLogsClient({
            logger: logger,
            origin: server.getUrl(),
            projectId: 'testProject',
            branchName: 'master'
        }),
        jobId = '/4/q/l',
        firstLog = 'hello world';

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
            logClient.appendTo(jobId, firstLog)
                .then(() => done())
                .catch(err => done(err));
        });

        it('should create job-logs directory', function() {
            assert(exists.sync(path.join(blobDir, 'log-storage')));
        });

        describe('getLog', function() {
            it('should return the logs from the job', function(done) {
                logClient.getLog(jobId).then(log => {
                    expect(log).to.contain(firstLog);
                    done();
                });
            });

            it('should append additional logs to the file', function(done) {
                var secondLog = 'goodbye world';
                logClient.appendTo(jobId, secondLog)
                    .then(() => logClient.getLog(jobId))
                    .then(log => {
                        expect(log).to.contain(secondLog);
                        done();
                    });
            });

        });
    });

    describe('delete', function() {
        var delJobId = '/4/8/l';

        before(function(done) {
            logClient.appendTo(delJobId, firstLog).then(() => done());
        });

        it('should delete the file from job-logs directory', function(done) {
            logClient.deleteLog(delJobId)
                .then(() => logClient.getLog(delJobId))
                .then(log => {
                    expect(log).to.equal('');
                    done();
                });
        });
    });

    describe('migration', function() {
        var client,
            jId = '/asd/4/q',
            logs = 'asdfasde',
            newBranch = 'otherBranch';

        before(function(done) {
            client = new JobLogsClient({
                logger: logger,
                origin: server.getUrl(),
                projectId: 'migTest',
                branchName: 'master'
            });
            // Write logs to job
            client.appendTo(jId, logs)
                .then(() => client.fork(newBranch))
                .catch(err => done(err))
                .then(() => done());
        });

        it('should migrate the edited nodes to the new branch', function(done) {
            client.getLog(jId).then(log => {
                expect(log).to.equal(logs);
                done();
            });
        });

        describe('new logs', function() {
            it('should not edit old job logs', function(done) {
                var c2 = new JobLogsClient({
                    logger: logger,
                    origin: server.getUrl(),
                    projectId: 'migTest',
                    branchName: 'master'
                });
                c2.getLog(jId).then(log => {
                    expect(log).to.equal(logs);
                    done();
                });
            });

            it('should write new logs', function(done) {
                client.appendTo(jId, 'moreStuff')
                    .then(() => client.getLog(jId))
                    .then(log => {
                        expect(log).to.contain('moreStuff');
                        done();
                    });
            });

        });

        // TODO: Test that, on a fork, the logClient will copy all the current jobs to 
        // the new fork name
    });

    describe('metadata', function() {
        var lineCount = 10,
            cmdCount = 2,
            createdIds = ['4/q/k/2'],
            jobId = '/4/q/k';

        before(function(done) {
            logClient.appendTo(jobId, firstLog, {lineCount, cmdCount, createdIds})
                .nodeify(done);
        });

        it('should store the lineCount, cmdCount', function(done) {
            logClient.getMetadata(jobId)
                .then(metadata => {
                    expect(metadata.lineCount).to.equal(lineCount);
                })
                .nodeify(done);
        });

    });
});
