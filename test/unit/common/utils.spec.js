describe('common/utils', function() {
    const assert = require('assert');
    const utils = require('../../../src/common/utils');

    describe('splitObj', function() {
        it('should set key/value in "selected" obj', function() {
            const [selected] = utils.splitObj({a: 1}, [['a']]);
            assert.equal(selected.a, 1);
        });

        it('should set nested key/value in "selected" obj', function() {
            const [selected] = utils.splitObj({a: {b: 1}}, [['a', 'b']]);
            assert.equal(selected.a.b, 1);
        });

        it('should rm keys from "remaining" obj', function() {
            const [,remaining] = utils.splitObj({a: 1}, [['a']]);
            assert.equal(remaining.a, undefined);
        });

        it('should rm nested keys from "remaining" obj', function() {
            const [,remaining] = utils.splitObj({a: {b: 1}}, [['a', 'b']]);
            assert.equal(remaining.a.b, undefined);
        });
    });

    describe('deepExtend', function() {
        it('should copy primitive vals', function() {
            const merged = utils.deepExtend({}, {a: 1});
            assert.equal(merged.a, 1);
        });

        it('should overwrite existing primitive vals', function() {
            const merged = utils.deepExtend({a: 2}, {a: 1});
            assert.equal(merged.a, 1);
        });

        it('should create nested objects as needed vals', function() {
            const merged = utils.deepExtend({}, {a: {b: 1}});
            assert.equal(merged.a.b, 1);
        });

        it('should copy nested primitive vals', function() {
            const merged = utils.deepExtend({a: {}}, {a: {b: 1}});
            assert.equal(merged.a.b, 1);
        });

        it('should merge nested objects', function() {
            const merged = utils.deepExtend({a: {c: 2}}, {a: {b: 1}});
            assert.equal(merged.a.b, 1);
            assert.equal(merged.a.c, 2);
        });
    });
});
