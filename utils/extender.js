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
extender.install['ExportFormat:Pipeline'] = (config, project) => {
    var installedExts,
        PLUGIN_ROOT = path.join(__dirname, '..', 'src', 'plugins', 'GenerateExecFile'),
        dstPath,
        content;

    // add the config to the current installed extensions of this type
    installedExts = allExtConfigs['ExportFormat:Pipeline'] = allExtConfigs['ExportFormat:Pipeline'] || [];
    installedExts.push(config);

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
        formatsIndex = formatTemplate({formats: installedExts});

    dstPath = path.join(PLUGIN_ROOT, 'format.js');
    fs.writeFileSync(dstPath, formatsIndex);
    persistExtConfig();
};

extender.uninstall['ExportFormat:Pipeline'] = name => {
};

module.exports = extender;
