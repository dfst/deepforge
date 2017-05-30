// Re-install all extensions
var extender = require('./extender'),
    Q = require('q'),
    extConfig = extender.getExtensionsConfig(),
    types,
    names,
    currentInstall = Q(),
    installCount = 0,
    config;

// Read the extensions and reinstall each of them
types = Object.keys(extConfig);
for (var i = types.length; i--;) {
    names = Object.keys(extConfig[types[i]]);
    if (names.length) {
        installCount += names.length;
        for (var j = names.length; j--;) {
            // eslint-disable-next-line no-console
            console.log(`Re-installing ${names[j]} extension...`);
            config = extConfig[types[i]][names[j]];
            currentInstall = currentInstall
                .then(() => extender.install(config.project.arg, true));
        }
    }
}

if (installCount) {
    // eslint-disable-next-line no-console
    currentInstall.then(() => console.log('Extensions reinstalled successfully'));
}
