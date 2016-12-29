// Utility for applying and removing deepforge extensions
// This utility is run by the cli when executing:
//
//     deepforge extensions add <project>
//     deepforge extensions remove <name>
//
var path = require('path'),
    fs = require('fs'),
    exists = require('exists-file'),
    CONFIG_DIR = path.join(process.env.HOME, '.deepforge'),
    EXT_CONFIG_NAME = 'extension.json',
    EXTENSION_REGISTRY_NAME = 'extensions.json',
    extConfigPath = path.join(CONFIG_DIR, EXTENSION_REGISTRY_NAME),
    allExtConfigs;

// Create the extensions.json if doesn't exist. Otherwise, load it
if (!exists.sync(extConfigPath)) {
    allExtConfigs = {};
} else {
    allExtConfigs = fs.readFileSync(extConfigPath, 'utf8');
}

var persistExtConfig = () => {
    fs.writeFileSync(extConfigPath, JSON.stringify(allExtConfigs, null, 2));
};

var extender = {
    install: {},
    uninstall: {}
};

extender.EXT_CONFIG_NAME = EXT_CONFIG_NAME;

extender.isSupportedType = function(type) {
    return extender.install[type] && extender.uninstall[type];
};

extender.getInstalledConfig = function(name) {
    return allExtConfigs[name] || null;
};

// Extension Types
// TODO
extender.install.ExportFormat = (config, project) => {
    // TODO: install export format...
    console.log('installing...');
    persistExtConfig();
};

extender.uninstall.ExportFormat = name => {
};

module.exports = extender;
