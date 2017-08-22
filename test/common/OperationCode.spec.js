describe('OperationCode', function() {
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
        var code;

        before(function() {
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'simple.py');
            code = fs.readFileSync(filePath, 'utf8');
        });

        describe('parsing', function() {
            beforeEach(function() {
                operation = new OperationCode(code);
            });

            it('should not require base class', function() {
                assert.equal(operation.getBase(), null);
            });

            it('should detect one output', function() {
                assert.equal(operation.getOutputs().length, 1);
            });

            it('should provide the value', function() {
                assert.equal(operation.getOutputs()[0].value, '20');
            });

            it('should detect two inputs', function() {
                assert.equal(operation.getInputs().length, 2);
            });
        });

        describe('addInput', function() {
            var operation;

            before(function() {
                operation = new OperationCode(code);
                operation.addInput('myNewInput');
            });

            it('should clear schema', function() {
                assert(!operation._schema);
            });

            it('should add input to `execute` fn', function() {
                var code = operation.getCode();
                assert(code.includes('myNewInput'));
            });

            it('should have an additional input arg', function() {
                var inputs = operation.getInputs();
                assert.equal(inputs.length, 3);
            });
        });

        describe('addOutput', function() {
            var operation;

            before(function() {
                operation = new OperationCode(code);
                operation.addOutput('myNewOutput');
            });

            it('should clear schema', function() {
                assert(!operation._schema);
            });

            it('should add input to `execute` fn', function() {
                var code = operation.getCode();
                assert(code.includes('myNewOutput'));
            });

            it('should have an additional input arg', function() {
                var inputs = operation.getOutputs();
                assert.equal(inputs.length, 2);
            });
        });

        describe('removeInput', function() {
            var operation,
                result;

            beforeEach(function() {
                operation = new OperationCode(code);
                result = operation.removeInput('number');
            });

            it('should return removed arg', function() {
                assert.equal(result.name, 'number');
            });

            it('should only have one remaining argument', function() {
                assert.equal(operation.getInputs().length, 1);
            });

            it('should only not have removed argument', function() {
                assert(!operation.getCode().includes('number'));
            });

            it('should return null if arg doesn\'t exist', function() {
                var result = operation.removeInput('numdasfber');
                assert.equal(result, null);
            });

        });

        describe('removeOutput', function() {
            var operation,
                result;

            beforeEach(function() {
                operation = new OperationCode(code);
                result = operation.removeOutput('result');
            });

            it('should return removed arg', function() {
                assert.equal(result.name, 'result');
            });

            it('should have no remaining results', function() {
                assert.equal(operation.getOutputs().length, 0);
            });

            it('should only not have removed argument', function() {
                assert(!operation.getCode().includes('20'));
            });

            it('should return null if arg doesn\'t exist', function() {
                var result = operation.removeOutput('numdasfber');
                assert.equal(result, null);
            });

        });
    });

});
