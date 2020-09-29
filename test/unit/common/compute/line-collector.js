describe('line collector', function() {
    const testFixture = require('../../../globals');
    const LineCollector = testFixture.requirejs('deepforge/compute/line-collector');
    const assert = require('assert');
    let collector;
    beforeEach(() => collector = new LineCollector());

    it('should group text by line', async function() {
        const data = [
            'abc',
            'def',
            '\n'
        ];
        const getData = new Promise(resolve => collector.on(resolve));
        data.forEach(data => collector.receive(data));
        const line = await getData;
        assert.equal(line, data.join('').trim());
    });

    it('should trigger callback on flush', async function() {
        const data = [
            'abc',
            'def',
        ];
        const getData = new Promise(resolve => collector.on(resolve));
        data.forEach(data => collector.receive(data));
        collector.flush();
        const line = await getData;
        assert.equal(line, data.join(''));
    });

    it('should pass each line to callback w/o dup', async function() {
        const data = [
            'abc\n',
            'def\n',
        ];
        let lines = '';
        collector.on(line => lines += line);
        data.forEach(data => collector.receive(data));
        assert.equal(lines, data.join('').replace(/\n/g, ''));
    });
});
