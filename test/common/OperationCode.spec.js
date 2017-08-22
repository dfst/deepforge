describe.only('OperationCode', function() {
    var fs = require('fs');
    var path = require('path');
    var assert = require('assert');
    var OperationCode = require('../../src/common/OperationCode');
    var operation;

    describe('example', function() {
        before(function() {
            // load the example
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'example.py');
            var example = fs.readFileSync(filePath, 'utf8');

            operation = new OperationCode(example);
        });

        it('should parse the correct name', function() {
            assert.equal(operation.getName(), 'ExampleOperation');
        });

        it.skip('should parse the correct base', function() {
            assert.equal(operation.getBase(), 'Operation');
        });

        describe('execute', function() {
            it('should parse the input names', function() {
                const names = ['hello', 'world', 'count'];
                assert.deepEqual(operation.getInputs().map(input => input.name), names);
            });

            it.skip('should parse the input types', function() {
                const types = ['str', 'str', 'int'];
                assert.deepEqual(operation.getInputs().map(input => input.type), types);
            });

            it('should parse the output names', function() {
                const names = ['concat', 'count'];
                assert.deepEqual(operation.getOutputs().map(output => output.name), names);
            });

            it.skip('should parse the output types', function() {
                const types = ['str', 'int'];
                assert.deepEqual(operation.getOutputs().map(output => output.type), types);
            });
        });
    });

    describe('simple', function() {
        before(function() {
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'simple.py');
            var example = fs.readFileSync(filePath, 'utf8');

            operation = new OperationCode(example);
        });

        it('should not require base class', function() {
            assert.equal(operation.getBase(), null);
        });

        it('should detect one output', function() {
            assert.equal(operation.getOutputs().length, 1);
        });

        it.only('should provide the value', function() {
            assert.equal(operation.getOutputs()[0].value, '20');
        });

        it('should detect two inputs', function() {
            assert.equal(operation.getInputs().length, 2);
        });
    });

});
