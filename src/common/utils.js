/* globals define*/
define([
], function(
) {
    var isBoolean = txt => {
        return typeof txt === 'boolean' || (txt === 'false' || txt === 'true');
    };

    var getSetterSchema = function(name, setters, defaults) {
        var values,
            schema = setters[name];

        if (defaults.hasOwnProperty(name)) {
            schema.default = defaults[name];
        }
        schema.type = 'string';
        if (schema.setterType === 'const') {
            values = Object.keys(schema.setterFn);
            schema.isEnum = true;
            schema.enumValues = values;
            if (values.every(isBoolean)) {
                if (!defaults.hasOwnProperty(name) && values.length === 1) {
                    // there is only a method to toggle the flag to true/false, 
                    // then the default must be the other one
                    schema.default = values[0] === 'true' ? false : true;
                }

                if (isBoolean(schema.default)) {
                    schema.type = 'boolean';
                }
            }
        }
        return schema;
    };

    return {
        getSetterSchema: getSetterSchema
    };
});
