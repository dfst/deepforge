/* globals define */

(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define(['path', 'module'], function(path, module){
            const __dirname = path.dirname(module.uri);
            return factory(require(__dirname + '/../routers/SciServerAuth/Tokens'));
        });
    } else if(typeof module === 'object' && module.exports) {
        module.exports = factory(require('../routers/SciServerAuth/Tokens'));
    } else {
        root.SciServerAuth = factory();
    }
}(this, function() {
    const isBrowser = typeof window !== 'undefined';

    async function getTokenBrowser(ssUser) {
        const url = `/routers/SciServerAuth/${ssUser}/token`;
        const response = await fetch(url);
        if (response.status < 400) {
            return await response.text();
        } else {
            throw new Error(await response.text());
        }
    }

    async function getToken(ssUser) {
        if (isBrowser) {
            return getTokenBrowser(ssUser);
        } else {
            throw new Error('Cannot retrieve SciServer token outside of browser.');
        }
    }

    return getToken;
}));
