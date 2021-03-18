/* globals define */
(function(root, factory){
    if(typeof define === 'function' && define.amd) {
        define([], function(){
            return factory();
        });
    } else if(typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CONSTANTS = factory();
    }
}(this, function() {
    const isBrowser = typeof window !== 'undefined';
    const TokenStorage = isBrowser ? null : require('../routers/SciServerAuth/Tokens');

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
