describe.only('OperationCode', function() {
    var fs = require('fs');
    var path = require('path');
    var assert = require('assert');
    var OperationCode = require('../../src/common/OperationCode');
    var operation;

    describe('example', function() {
        var code;

        before(function() {
            // load the example
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'example.py');
            code = fs.readFileSync(filePath, 'utf8');
        });

        describe('removeInput', function() {
            before(function() {
                operation = new OperationCode(code);
                operation.removeInput('world');
            });

            it('should have 2 remaining inputs', function() {
                assert.equal(operation.getInputs().length, 2);
            });

        });

        describe('attributes', function() {
            describe('add', function() {
                beforeEach(function() {
                    operation = new OperationCode(code);
                });

                it('should add argument to __init__ method', function() {
                    operation.addAttribute('number');
                    var attrs = operation.getAttributes();
                    // TODO
                });

                it('should set the default value', function() {
                    // TODO
                });
            });

            // TODO: add attribute
            // TODO: remove attribute
            // TODO: rename attribute?
        });

        describe('rename', function() {
            before(function() {
                operation = new OperationCode(code);
                operation.rename('hello', 'goodbye');
            });

            it('should rename input arg', function() {
                var inputs = operation.getInputs();
                var oldInput = inputs.find(input => input.name === 'hello');
                var newInput = inputs.find(input => input.name === 'goodbye');

                assert(!oldInput);
                assert(newInput);
            });

            it('should rename occurrences in the fn', function() {
                assert(!operation.getCode().includes('hello'));
            });
        });

        describe('parsing', function() {
            before(function() {
                operation = new OperationCode(code);
            });

            it('should parse the correct name', function() {
                assert.equal(operation.getName(), 'ExampleOperation');
            });

            it.skip('should parse the correct base', function() {
                assert.equal(operation.getBase(), 'Operation');
            });

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

    describe('multi-anon-results', function() {
        before(function() {
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'multi-anon-results.py');
            var example = fs.readFileSync(filePath, 'utf8');
            operation = new OperationCode(example);
        });

        it('should parse multiple return values', function() {
            assert.equal(operation.getOutputs().length, 2);
        });

        it('should create unique names for each', function() {
            var [first, second] = operation.getOutputs();
            assert.notEqual(first.name, second.name);
        });
    });

    describe('no-inputs/outputs', function() {
        var code;

        before(function() {
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'no-inputs.py');
            code = fs.readFileSync(filePath, 'utf8');
        });

        describe('parsing', function() {
            beforeEach(function() {
                operation = new OperationCode(code);
            });

            it('should not require base class', function() {
                assert.equal(operation.getBase(), null);
            });

            it('should detect zero output', function() {
                assert.equal(operation.getOutputs().length, 0);
            });

            it('should detect zero inputs', function() {
                assert.equal(operation.getInputs().length, 0);
            });
        });

        describe('addInput', function() {
            var operation;

            before(function() {
                operation = new OperationCode(code);
                operation.addInput('first');
            });

            it('should clear schema', function() {
                assert(!operation._schema);
            });

            it('should add input to `execute` fn', function() {
                var code = operation.getCode();
                assert(code.includes('first'));
            });

            it('should have an additional input arg', function() {
                var inputs = operation.getInputs();
                assert.equal(inputs.length, 1);
            });
        });

        describe('addOutput', function() {
            var operation;

            describe('lone return', function() {
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
                    assert.equal(inputs.length, 1);
                });
            });

            describe('no return', function() {
                before(function() {
                    operation = new OperationCode(code);
                    operation.addReturnValue('no_return', 'myNewOutput');
                });

                it('should clear schema', function() {
                    assert(!operation._schema);
                });

                it('should add input to `execute` fn', function() {
                    var code = operation.getCode();
                    assert(code.includes('myNewOutput'));
                });

                it('should have an additional input arg', function() {
                    var outputs = operation.getReturnValues('no_return');
                    assert.equal(outputs.length, 1);
                });
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
