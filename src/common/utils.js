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

    const defer = function() {
        const deferred = {resolve: null, reject: null};
        deferred.promise = new Promise((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        return deferred;
    };

    const withTimeout = function(fn, err, time=1500) {
        return async function() {
            let deferred = defer();
            let result = null;

            setTimeout(() => {
                if (!result) {
                    deferred.reject(err);
                }
            }, time);

            result = await fn.call(this);
            deferred.resolve(result);
            return deferred.promise;
        };
    };

    return {
        resolveCarriageReturns,
        abbr,
        withTimeout,
        defer,
    };
}));
