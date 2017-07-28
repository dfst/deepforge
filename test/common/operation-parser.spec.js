describe('OperationParser', function() {
    var assert = require('assert');
    var schema;

    before(function() {
        var parser = require('../../src/common/OperationParser');

        // load the example
        var fs = require('fs');
        var path = require('path');
        var filePath = path.join(__dirname, '..', 'test-cases', 'operations', 'example.py');
        var example = fs.readFileSync(filePath, 'utf8');

        schema = parser.parse(example);
    });

    it('should parse the correct name', function() {
        assert.equal(schema.name, 'ExampleOperation');
    });

    it('should parse the correct base', function() {
        assert.equal(schema.base, 'Operation');
    });

    describe('execute', function() {
        it('should parse the input names', function() {
            const names = ['hello', 'world', 'count'];
            assert.deepEqual(schema.inputs.map(input => input.name), names);
        });

        it.only('should parse the input types', function() {
            const types = ['str', 'str', 'int'];
            assert.deepEqual(schema.inputs.map(input => input.type), types);
        });

        it.only('should parse the output names', function() {
            const names = ['concat', 'count'];
            assert.deepEqual(schema.outputs.map(output => output.name), names);
        });

        it('should parse the output types', function() {
            const types = ['str', 'int'];
            assert.deepEqual(schema.outputs.map(output => output.type), types);
        });
    });
});
