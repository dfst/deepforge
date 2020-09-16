describe('InteractiveCompute', function() {
    const assert = require('assert').strict;
    const {promisify} = require('util');
    const testFixture = require('../globals');
    const gmeConfig = testFixture.getGmeConfig();
    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    const Message = testFixture.requirejs('deepforge/compute/interactive/message');
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);
    let session;

    before(async function() {
        await server.start();
    });
    after(async function() {
        await server.stop();
    });

    beforeEach(async function() {
        const Session = testFixture.requirejs('deepforge/compute/interactive/session-with-queue');
        session = await Session.new('local');
    });
    afterEach(() => session.close());

    it('should be able to exec commands', async function() {
        const {exitCode, stdout} = await session.exec('ls');
        assert.equal(exitCode, 0);
        const files = stdout.split('\n');
        assert(files.includes('start.js'));
    });

    it('should be able to spawn commands', function(done) {
        const task = session.spawn('ls');
        task.on(Message.COMPLETE, exitCode => {
            assert.equal(exitCode, 0);
            done();
        });
    });

    it('should be able to add files', async function() {
        await session.addFile('test.txt', 'hello world');
        const {stdout} = await session.exec('cat test.txt');
        assert.equal(stdout, 'hello world');
    });

    it('should remove file', async function() {
        try {
            await session.addFile('test.txt', 'hello world');
            await session.removeFile('test.txt');
            await session.exec('cat test.txt');
            assert(false, new Error('Expected file to be deleted.'));
        } catch (err) {
            assert(err.jobResult, err);
            assert(err.jobResult.stderr.includes('No such file'));
        }
    });

    it('should cancel tasks', function(done) {
        const task = session.spawn('sleep 20');
        task.on(Message.COMPLETE, () => done());
        sleep(100).then(() => session.kill(task));
    });

    it('should save artifacts', async function() {
        await session.exec('node -e \'fs.writeFileSync("test.txt", "hi")\'');
        const dataInfo = await session.saveArtifact('test.txt', 'test', 'gme');
        assert.equal(dataInfo.backend, 'gme');
        assert(dataInfo.data);
    });

    it('should support multiplexing', async function() {
        session.exec('sleep 20');
        const s2 = session.fork();
        const {stdout} = await s2.exec('echo "hi"');
        assert.equal(stdout, 'hi\n');
    });

    function sleep(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
});
