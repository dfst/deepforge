describe('InteractiveClient worker script', function() {
    const testFixture = require('../../../globals');
    const assert = require('assert').strict;
    let InteractiveClient;

    before(() => {
        InteractiveClient = require(testFixture.PROJECT_ROOT + '/src/routers/InteractiveCompute/job-files/start').InteractiveClient;
    });

    describe('parseCommand', function() {
        it('should parse separate words ("ab cd efg h")', function() {
            const cmd = 'ab cd efg h';
            const chunks = InteractiveClient.parseCommand(cmd);
            assert.equal(chunks.join(' '), cmd);
        });

        it('should parse "ab \'cd efg h\'"', function() {
            const cmd = 'ab \'cd efg h\'';
            const chunks = InteractiveClient.parseCommand(cmd);
            assert.equal(chunks.length, 2);
            assert.equal(chunks[0], 'ab');
        });

        it('should parse "ab "cd efg h""', function() {
            const cmd = 'ab "cd efg h"';
            const chunks = InteractiveClient.parseCommand(cmd);
            assert.equal(chunks.length, 2);
            assert.equal(chunks[0], 'ab');
        });
    });
});
