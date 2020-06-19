describe('InteractiveCompute', function() {
    const assert = require('assert').strict;
    const {promisify} = require('util');
    const testFixture = require('../globals');
    const gmeConfig = testFixture.getGmeConfig();
    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
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
        const Message = testFixture.requirejs('deepforge/compute/interactive/message');
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
});
