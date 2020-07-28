describe('PythonSliceParser', function() {
    const {requirejs} = require('../../../../globals');
    const SliceParser = requirejs('widgets/TensorPlotter/PythonSliceParser');
    const assert = require('assert').strict;

    it('should return start shape if passed blank string', function() {
        const shape = [10, 5];
        const newShape = SliceParser(shape, '');
        assert.deepEqual(newShape, shape);
    });

    describe('indices', function() {
        it('should remove first dimension using "[0]"', function() {
            const shape = [10, 5];
            const newShape = SliceParser(shape, '[0]');
            assert.deepEqual(newShape, [5]);
        });

        it('should remove multiple dimensions using "[0,1]"', function() {
            const shape = [10, 5];
            const newShape = SliceParser(shape, '[0,1]');
            assert.deepEqual(newShape, []);
        });

        it('should remove multiple dimensions using "[0][1]"', function() {
            const shape = [10, 5];
            const newShape = SliceParser(shape, '[0][1]');
            assert.deepEqual(newShape, []);
        });

        it('should remove multiple dimensions using "[0,-1]"', function() {
            const shape = [10, 5, 4];
            const newShape = SliceParser(shape, '[0,-1]');
            assert.deepEqual(newShape, [4]);
        });
    });

    describe('slices', function() {
        it('should not remove any dimensions using "[:]"', function() {
            const shape = [10, 5, 4];
            const newShape = SliceParser(shape, '[:]');
            assert.deepEqual(newShape, shape);
        });

        it('should compute dimensions using step "[0:10:2]"', function() {
            const shape = [10, 5, 4];
            const newShape = SliceParser(shape, '[0:10:2]');
            assert.deepEqual(newShape, [5, 5, 4]);
        });

        it('should compute dimensions from odd len "[0:10:2]"', function() {
            const shape = [9, 5, 4];
            const newShape = SliceParser(shape, '[0:10:2]');
            assert.deepEqual(newShape, [5, 5, 4]);
        });

        it('should compute dimensions using step "[0:10:2,0:6:2]"', function() {
            const shape = [10, 5, 4];
            const newShape = SliceParser(shape, '[0:10:2,0:6:2]');
            assert.deepEqual(newShape, [5, 3, 4]);
        });

        it('should remove dimensions using negative indices "[-2:-1]"', function() {
            const shape = [10, 5, 4];
            const newShape = SliceParser(shape, '[-2:-1]');
            assert.deepEqual(newShape, [1, 5, 4]);
        });

        it('should remove all dims if slice is too large "[100:1]"', function() {
            const shape = [10, 5, 4];
            const newShape = SliceParser(shape, '[100:1]');
            assert.deepEqual(newShape, []);
        });
    });

    describe('slices and indices', function() {
        it('should compute dimensions using "[:,0]"', function() {
            const shape = [100, 1];
            const newShape = SliceParser(shape, '[:,0]');
            assert.deepEqual(newShape, [100]);
        });

        it('should compute dimensions using "[:,0,0,0:2]"', function() {
            const shape = [100, 65, 65, 5];
            const newShape = SliceParser(shape, '[:,0,0,0:2]');
            assert.deepEqual(newShape, [100, 2]);
        });
    });
});
