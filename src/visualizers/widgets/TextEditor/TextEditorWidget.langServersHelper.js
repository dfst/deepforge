/* globals define, monaco*/
/* eslint-env browser */

define([
    'js/Utils/ComponentSettings',
], function (
    ComponentSettings
) {
    const LangServerConfig = ComponentSettings.resolveWithWebGMEGlobal(
        {},
        'LanguageServers'
    );

    const LanguageServersHelper = {
        isLanguageServerAvailable: function(language) {
            return !!LangServerConfig && !!LangServerConfig.hostName &&
                Object.keys(LangServerConfig.servers).includes(language);
        },

        getLanguageServerHostName: function(language) {
            if (LangServerConfig) {
                let protocol = LangServerConfig.hostName.startsWith('https') ? 'wss' : 'ws';
                return LangServerConfig.hostName.replace(/https?/, protocol) + `/${language}`;
            }
        },

        getInitializationOptionsFor: function(language) {
            if(this.isLanguageServerAvailable(language)) {
                return LangServerConfig.servers[language].init;
            }
        },

        getWorkspaceURIFor: function(language) {
            if(this.isLanguageServerAvailable(language)) {
                return monaco.Uri.parse(
                    LangServerConfig.servers[language].workspace
                );
            }
        }
    };

    return LanguageServersHelper;
});
