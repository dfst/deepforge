describe.only('OperationParser', function() {
    var fs = require('fs');
    var path = require('path');
    var assert = require('assert');
    var parser = require('../../src/common/OperationParser');
    var schema;

    describe('example', function() {
        before(function() {
            // load the example
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'example.py');
            var example = fs.readFileSync(filePath, 'utf8');

            schema = parser.parse(example);
        });

        it('should parse the correct name', function() {
            assert.equal(schema.name, 'ExampleOperation');
        });

        it.skip('should parse the correct base', function() {
            assert.equal(schema.base, 'Operation');
        });

        describe('execute', function() {
            it('should parse the input names', function() {
                const names = ['hello', 'world', 'count'];
                assert.deepEqual(schema.inputs.map(input => input.name), names);
            });

            it.skip('should parse the input types', function() {
                const types = ['str', 'str', 'int'];
                assert.deepEqual(schema.inputs.map(input => input.type), types);
            });

            it('should parse the output names', function() {
                const names = ['concat', 'count'];
                assert.deepEqual(schema.outputs.map(output => output.name), names);
            });

            it.skip('should parse the output types', function() {
                const types = ['str', 'int'];
                assert.deepEqual(schema.outputs.map(output => output.type), types);
            });
        });
    });

    describe('simple', function() {
        before(function() {
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'simple.py');
            var example = fs.readFileSync(filePath, 'utf8');

            schema = parser.parse(example);
        });

        it('should not require base class', function() {
            assert.equal(schema.base, null);
        });

        it('should detect one output', function() {
            assert.equal(schema.outputs.length, 1);
        });

        it('should detect two inputs', function() {
            assert.equal(schema.inputs.length, 2);
        });
    });
});
