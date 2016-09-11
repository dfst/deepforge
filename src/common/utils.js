/* globals define*/
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define([], function(){
            return (root.utils = factory());
        });
    } else if(typeof module === 'object' && module.exports) {
        module.exports = (root.utils = factory());
    }
}(this, function() {
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

    var abbrWord = function(word) {  // camelcase
        word = word.substring(0, 1).toUpperCase() + word.substring(1);
        return word.split(/[a-z]+/g).join('').toLowerCase();
    };

    var abbrPhrase = function(words) {  // dashes, spaces, underscores, etc
        return words.map(word => word[0]).join('');
    };

    var abbr = function(phrase) {
        var words = phrase.split(/[^a-zA-Z0-9]+/g);
        if (words.length === 1) {
            return abbrWord(phrase);
        } else {
            return abbrPhrase(words);
        }
    };

    // Resolving stdout
    var resolveCarriageReturns = function(text) {
        // resolve \r
        var lines,
            chars,
            result,
            i = 0;

        text = text.replace(/\u0000/g, '');
        lines = text.split('\n');
        for (var l = lines.length-1; l >= 0; l--) {
            i = 0;
            chars = lines[l].split('');
            result = [];

            for (var c = 0; c < chars.length; c++) {
                if (chars[c] === '\r') {
                    i = 0;
                }
                result[i] = chars[c];
                i++;
            }
            lines[l] = result.join('');
        }
        return lines;
    };


    return {
        getSetterSchema: getSetterSchema,
        resolveCarriageReturns: resolveCarriageReturns,
        abbr: abbr
    };
}));
