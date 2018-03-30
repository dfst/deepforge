describe('OperationCode', function() {
    var fs = require('fs');
    var path = require('path');
    var assert = require('assert');
    var OperationCode = require('../../../src/common/OperationCode');
    var operation;

    describe('example', function() {
        var code;

        before(function() {
            // load the example
            var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'example.py');
            code = fs.readFileSync(filePath, 'utf8');
        });

        describe('name', function() {
            beforeEach(function() {
                operation = new OperationCode(code);
            });

            it('should get the correct name', function() {
                assert.equal(operation.getName(), 'ExampleOperation');
            });

            it('should set the name', function() {
                operation.setName('NewName');
                assert.equal(operation.getName(), 'NewName');
            });

            it('should not remove the parens', function() {
                operation.setName('NewName');
                assert(operation.getCode().includes('class NewName('));
            });

            it('should set the name in the code', function() {
                operation.setName('NewName');
                var code = operation.getCode();
                assert(!code.includes('ExampleOperation'));
                assert(code.includes('NewName'));
            });
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
                    assert(attrs.find(attr => attr.name === 'number'));
                });

                it('should add `self` argument to __init__ method', function() {
                    operation.addAttribute('number');
                    let code = operation.getCode();
                    assert(code.includes('__init__(self'));
                });

                it('should set the default value', function() {
                    operation.addAttribute('number', 50);
                    var code = operation.getCode();
                    assert(code.includes('number=50'));
                });

            });

            describe('multiple args', function() {
                beforeEach(function() {
                    operation = new OperationCode(code);
                    operation.addAttribute('first', 50);
                });

                it('should add non-default argument before default args', function() {
                    operation.addAttribute('test');
                    var code = operation.getCode();
                    assert(code.includes('test, first=50'));
                });

                it('should re-order args as needed when removing default values', function() {
                    operation.addAttribute('test', true);
                    operation.removeAttributeDefault('test');
                    var code = operation.getCode(),
                        firstIndex = code.indexOf('first'),
                        testIndex = code.indexOf('test');

                    assert(code.includes('first=50'));
                    assert(firstIndex > testIndex);
                });

                it('should add default argument after default args', function() {
                    operation.addAttribute('test', true);
                    var code = operation.getCode(),
                        firstIndex = code.indexOf('first'),
                        testIndex = code.indexOf('test');

                    assert(firstIndex < testIndex);
                });

                it('should add multiple default args', function() {
                    operation.addAttribute('test', true);
                    operation.addAttribute('t3', 12);
                    operation.addAttribute('t2', 'hello');

                    var code = operation.getCode();

                    assert(code.includes('test=True'));
                    assert(code.includes('t2=\'hello\''));
                    assert(code.includes('t3=12'));
                });
            });

            describe('setAttributeDefault', function() {
                beforeEach(function() {
                    operation = new OperationCode(code);
                });

                it('should set the default value', function() {
                    operation.addAttribute('number');
                    operation.setAttributeDefault('number', 50);
                    var code = operation.getCode();
                    assert(code.includes('number=50'));
                });

                it('should change the default value', function() {
                    operation.addAttribute('number');
                    operation.setAttributeDefault('number', 50);
                    operation.setAttributeDefault('number', 7);
                    var code = operation.getCode();
                    assert(code.includes('number=7)'));
                });

                it.skip('should remove string defaults', function() {
                    operation.addAttribute('number', 'hello');
                    operation.removeAttributeDefault('number');
                    var code = operation.getCode();
                    assert(code.includes('number)'));
                });

                it('should add quotes to default string', function() {
                    operation.addAttribute('number');
                    operation.setAttributeDefault('number', 'hello');
                    var code = operation.getCode();
                    assert(code.includes('number=\'hello\')'));
                });

                it('should convert boolean to python bool', function() {
                    operation.addAttribute('number');
                    operation.setAttributeDefault('number', true);
                    var code = operation.getCode();
                    assert(code.includes('number=True)'));
                });
            });
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

    describe.skip('no-inputs/outputs', function() {
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

            it.skip('should provide the value', function() {
                assert.equal(operation.getOutputs()[0].value, '20');
            });

            it('should detect one input', function() {
                assert.equal(operation.getInputs().length, 1);
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
                assert.equal(inputs.length, 2);
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

            it('should have no remaining inputs', function() {
                assert.equal(operation.getInputs().length, 0);
            });

            it('should have removed argument', function() {
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

            it('should have removed argument', function() {
                assert(!operation.getCode().includes('20'));
            });

            it('should return null if arg doesn\'t exist', function() {
                var result = operation.removeOutput('numdasfber');
                assert.equal(result, null);
            });

        });

        describe('attributes', function() {
            describe('get', function() {
                beforeEach(function() {
                    let filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'example.py');
                    let code = fs.readFileSync(filePath, 'utf8');
                    operation = new OperationCode(code);
                });

                it('should return empty array if no ctor', function() {
                    var attrs = operation.getAttributes();
                    assert.equal(attrs.length, 0);
                });
            });

            describe('remove', function() {
                beforeEach(function() {
                    operation = new OperationCode(code);
                });

                it('should remove argument from __init__ method', function() {
                    operation.removeAttribute('attr');
                    var attrs = operation.getAttributes();
                    assert(!attrs.find(attr => attr.name === 'attr'));
                });

                it('should remove argument w/ default value', function() {
                    operation.removeAttribute('withDefault');
                    var attrs = operation.getAttributes();
                    assert(!attrs.find(attr => attr.name === 'withDefault'));
                });

                it('should remove default value', function() {
                    operation.removeAttribute('withDefault');
                    var code = operation.getCode();
                    assert(!code.includes('5'));
                });
            });
            // TODO: rename attribute?
        });
    });

});
