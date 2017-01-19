// Utility for applying and removing deepforge extensions
// This utility is run by the cli when executing:
//
//     deepforge extensions add <project>
//     deepforge extensions remove <name>
//
var path = require('path'),
    fs = require('fs'),
    exists = require('exists-file'),
    makeTpl = require('lodash.template'),
    CONFIG_DIR = path.join(process.env.HOME, '.deepforge'),
    EXT_CONFIG_NAME = 'extension.json',
    EXTENSION_REGISTRY_NAME = 'extensions.json',
    extConfigPath = path.join(CONFIG_DIR, EXTENSION_REGISTRY_NAME),
    allExtConfigs;

var values = obj => Object.keys(obj).map(key => obj[key]);

// Create the extensions.json if doesn't exist. Otherwise, load it
if (!exists.sync(extConfigPath)) {
    allExtConfigs = {};
} else {
    try {
        allExtConfigs = JSON.parse(fs.readFileSync(extConfigPath, 'utf8'));
    } catch (e) {
        throw `Invalid config at ${extConfigPath}: ${e.toString()}`;
    }
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
extender.install['Export:Pipeline'] = (config, project) => {
    var installedExts,
        PLUGIN_ROOT = path.join(__dirname, '..', 'src', 'plugins', 'GenerateExecFile'),
        dstPath,
        content;

    // add the config to the current installed extensions of this type
    allExtConfigs['Export:Pipeline'] = allExtConfigs['Export:Pipeline'] || {};

    if (allExtConfigs['Export:Pipeline'][config.name]) {
        console.log(`Extension ${config.name} already installed. Reinstalling...`);
    }

    allExtConfigs['Export:Pipeline'][config.name] = config;

    installedExts = values(allExtConfigs['Export:Pipeline']);

    // copy the main script to src/plugins/GenExecFile/formats/<name>/<main>
    dstPath = path.join(PLUGIN_ROOT, 'formats', config.name);
    if (!exists.sync(dstPath)) {
        fs.mkdirSync(dstPath);
    }

    try {
        content = fs.readFileSync(path.join(project.root, config.main), 'utf8');
    } catch (e) {
        throw 'Could not read the extension\'s main file: ' + e;
    }
    dstPath = path.join(dstPath, path.basename(config.main));
    fs.writeFileSync(dstPath, content);

    // regenerate the format.js file from the template
    var formatTemplate = makeTpl(fs.readFileSync(path.join(PLUGIN_ROOT, 'format.js.ejs'), 'utf8')),
        formatsIndex = formatTemplate({path: path, formats: installedExts});

    dstPath = path.join(PLUGIN_ROOT, 'format.js');
    fs.writeFileSync(dstPath, formatsIndex);
    persistExtConfig();
};

extender.uninstall['Export:Pipeline'] = name => {
};

module.exports = extender;
