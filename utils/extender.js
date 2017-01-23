// Utility for applying and removing deepforge extensions
// This utility is run by the cli when executing:
//
//     deepforge extensions add <project>
//     deepforge extensions remove <name>
//
var path = require('path'),
    fs = require('fs'),
    rm_rf = require('rimraf'),
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
    var group = values(allExtConfigs).find(typeGroup => {
        return !!typeGroup[name];
    });
    return group && group[name];
};

var makeInstallFor = function(typeCfg) {
    var saveExtensions = () => {
        // regenerate the format.js file from the template
        var installedExts = values(allExtConfigs[typeCfg.type]),
            formatTemplate = makeTpl(fs.readFileSync(typeCfg.template, 'utf8')),
            formatsIndex = formatTemplate({path: path, formats: installedExts}),
            dstPath = typeCfg.template.replace(/\.ejs$/, '');

        fs.writeFileSync(dstPath, formatsIndex);
        persistExtConfig();
    };

    // Given a...
    //  - template file
    //  - extension type
    //  - target path tpl
    // create the installation/uninstallation functions
    extender.install[typeCfg.type] = (config, project) => {
        var dstPath,
            content;

        // add the config to the current installed extensions of this type
        allExtConfigs[typeCfg.type] = allExtConfigs[typeCfg.type] || {};

        if (allExtConfigs[typeCfg.type][config.name]) {
            console.log(`Extension ${config.name} already installed. Reinstalling...`);
        }

        allExtConfigs[typeCfg.type][config.name] = config;

        // copy the main script to src/plugins/Export/formats/<name>/<main>
        dstPath = makeTpl(typeCfg.targetDir)(config);
        if (!exists.sync(dstPath)) {
            fs.mkdirSync(dstPath);
        }

        try {
            // TODO: Should I copy a directory instead of a main file?
            content = fs.readFileSync(path.join(project.root, config.main), 'utf8');
        } catch (e) {
            throw 'Could not read the extension\'s main file: ' + e;
        }
        dstPath = path.join(dstPath, path.basename(config.main));
        fs.writeFileSync(dstPath, content);

        saveExtensions();
    };

    // uninstall
    extender.uninstall['Export:Pipeline'] = name => {
        // Remove from config
        allExtConfigs[typeCfg.type] = allExtConfigs[typeCfg.type] || {};

        if (!allExtConfigs[typeCfg.type][name]) {
            console.log(`Extension ${name} not installed`);
            return;
        }
        var config = allExtConfigs[typeCfg.type][name],
            dstPath = makeTpl(typeCfg.targetDir)(config);

        // Remove the dstPath
        delete allExtConfigs[typeCfg.type][name];
        rm_rf.sync(dstPath);

        // Re-generate template file
        saveExtensions();
    };

};

var PLUGIN_ROOT = path.join(__dirname, '..', 'src', 'plugins', 'Export');
makeInstallFor({
    type: 'Export:Pipeline',
    template: path.join(PLUGIN_ROOT, 'format.js.ejs'),
    targetDir: path.join(PLUGIN_ROOT, 'formats', '<%=name%>'),
});

module.exports = extender;
