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
}(this, function(TokenStorage) {
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

    async function getTokenNodeJS(ssUser, dfUser) {
        return await TokenStorage.getToken(dfUser, ssUser);
    }

    async function getToken(ssUser, dfUser) {
        if (isBrowser) {
            return getTokenBrowser(ssUser);
        } else {
            return getTokenNodeJS(ssUser, dfUser);
        }
    }

    return getToken;
}));
