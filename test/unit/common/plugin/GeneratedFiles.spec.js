describe('GeneratedFiles', function() {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    const GeneratedFiles = testFixture.requirejs('deepforge/plugin/GeneratedFiles');

    describe('should ensure files are strings', function() {
        const failingCases = [
            {hello: 'world'},
            120,
            true,
        ];
        failingCases.forEach(data => {
            it(`should throw with "${typeof data}" data`, function () {
                const files = new GeneratedFiles();
                assert.throws(() => files.addFile('test.txt', data));
            });
        });

        it('should add text file', function() {
            const files = new GeneratedFiles();
            files.addFile('test.txt', 'test data');
        });
    });
});
