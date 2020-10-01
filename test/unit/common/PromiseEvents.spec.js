describe('PromiseEvents', function() {
    const assert = require('assert');
    const testFixture = require('../../globals');
    const PromiseEvents = testFixture.requirejs('deepforge/PromiseEvents');

    it('should resolve as a promise', async function() {
        const five = await PromiseEvents.new(
            resolve => setTimeout(() => resolve(5), 5)
        );
        assert.equal(five, 5);
    });

    it('should support updates', async function() {
        const promise = PromiseEvents.new(function(resolve) {
            for (let i = 1; i < 6; i++) {
                this.emit('update', i);
            }
            resolve(6);
        });
        const events = [];
        promise.on('update', status => events.push(status));
        const six = await promise;
        assert.equal(events.length, 5);
        assert.equal(six, 6);
    });
});
