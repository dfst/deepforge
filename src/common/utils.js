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

    const splitObj = function (obj, nestedKeys) {
        const selected = {};
        const remaining = deepCopy(obj);
        nestedKeys.forEach(keys => {
            const value = deepGet(obj, keys);
            deepSet(selected, keys, value);
            deepDelete(remaining, keys);
        });

        return [selected, remaining];
    };

    const deepDelete = function (obj, nestedKeys) {
        const allButLast = nestedKeys.slice(0, nestedKeys.length - 1);
        const nestedObj = deepGet(obj, allButLast);
        const lastKey = nestedKeys.slice().pop();
        delete nestedObj[lastKey];
    };

    const deepGet = function (obj, nestedKeys) {
        return nestedKeys.reduce((value, key) => value[key], obj);
    };

    const deepSet = function (obj, nestedKeys, value) {
        const allButLast = nestedKeys.slice(0, nestedKeys.length-1);
        const nestedObj = createNestedObjs(obj, allButLast);
        const lastKey = nestedKeys[nestedKeys.length - 1];
        nestedObj[lastKey] = value;
    };

    const createNestedObjs = function (obj, nestedKeys) {
        nestedKeys.forEach(key => {
            if (!obj[key]) {
                obj[key] = {};
            }
            obj = obj[key];
        });
        return obj;
    };

    const deepCopy = v => JSON.parse(JSON.stringify(v));

    const deepExtend = function (obj1, obj2) {
        Object.entries(obj2).forEach(entry => {
            const [key, value] = entry;
            const mergeRequired = typeof obj1[key] === 'object' &&
                typeof value === 'object';

            if (mergeRequired) {
                deepExtend(obj1[key], value);
            } else {
                obj1[key] = value;
            }
        });
        return obj1;
    };

    async function sleep(duration) {
        const deferred = defer();
        setTimeout(deferred.resolve, duration);
        return deferred.promise;
    }

    async function waitUntil(fn, interval=50) {
        while (!await fn()) {
            await sleep(interval);
        }
    }

    return {
        deepExtend,
        splitObj,
        resolveCarriageReturns,
        abbr,
        withTimeout,
        defer,
        sleep,
        waitUntil,
    };
}));
