describe('PlottedDataEditor', function() {
    const {requirejs} = require('../../../../globals');
    const PlottedDataEditor = requirejs('widgets/TensorPlotter/PlottedDataEditor');
    const assert = require('assert').strict;

    describe('getAllVariableNames', function() {
        it('should detect nested values', function() {
            const metadata = {
                name: 'test',
                entries: [
                    {
                        name: 'a',
                        shape: [1, 2]
                    },
                    {
                        name: 'b',
                        shape: [1, 2]
                    }
                ]
            };
            const names = PlottedDataEditor.getAllVariableNames(metadata);
            assert.deepEqual(names, [`test["a"]`, `test["b"]`]);
        });

        it('should detect deeply nested values', function() {
            const metadata = {
                name: 'test',
                entries: [
                    {
                        name: 'a',
                        entries: [
                            {
                                name: 'c',
                                shape: [1, 2]
                            },
                            {
                                name: 'd',
                                shape: [1, 2]
                            }
                        ]
                    },
                    {
                        name: 'b',
                        shape: [1, 2]
                    }
                ]
            };
            const names = PlottedDataEditor.getAllVariableNames(metadata);
            assert.deepEqual(
                names,
                [
                    `test["a"]["c"]`,
                    `test["a"]["d"]`,
                    `test["b"]`,
                ]
            );
        });
    });
});
