describe('Version', function() {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    const Version = testFixture.requirejs('deepforge/updates/Version');

    const lessThanTestCases = [
        ['0.8.2', '0.10.2'],
        ['0.8.2', '0.10.2'],
        ['0.8.2', '1.0.0'],
        ['0.0.2', '0.1.0'],
    ];
    const equalTestCases = [
        ['0.8.2', '0.08.02'],
        ['  0.8.2', '0.8.2']
    ];
    equalTestCases.forEach(testCase => {
        const [vs1, vs2] = testCase;
        it(`should detect ${vs1} == ${vs2}`, () => {
            const v1 = new Version(vs1);
            const v2 = new Version(vs2);
            assert(v1.equalTo(v2));
        });
    });

    lessThanTestCases.forEach(testCase => {
        const [vs1, vs2] = testCase;
        const v1 = new Version(vs1);
        const v2 = new Version(vs2);

        it(`should detect ${vs1} < ${vs2}`, () => {
            assert(v1.lessThan(v2));
        });

        it(`should detect ${vs2} > ${vs1}`, () => {
            assert(v2.greaterThan(v1));
        });
    });
});
