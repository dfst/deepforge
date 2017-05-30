// Utility for applying and removing deepforge extensions
// This utility is run by the cli when executing:
//
//     deepforge extensions add <project>
//     deepforge extensions remove <name>
//
var path = require('path'),
    fs = require('fs'),
    npm = require('npm'),
    Q = require('q'),
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

var extender = {};

extender.EXT_CONFIG_NAME = EXT_CONFIG_NAME;

extender.isSupportedType = function(type) {
    return extender.install[type] && extender.uninstall[type];
};

extender.getExtensionsConfig = function() {
    return allExtConfigs;
};

extender.getInstalledConfig = function(name) {
    var group = values(allExtConfigs).find(typeGroup => {
        return !!typeGroup[name];
    });
    return group && group[name];
};

extender.install = function(project, isReinstall) {
    // Install the project
    return Q.ninvoke(npm, 'load', {})
        .then(() => Q.ninvoke(npm, 'install', project))
        .then(results => {
            var installed = results[0],
                extProject,
                extRoot;

            extProject = installed[0][0];
            extRoot = installed[0][1];

            // Check for the extensions.json in the project (look up type, etc)
            var extConfigPath = path.join(extRoot, extender.EXT_CONFIG_NAME),
                extConfig,
                extType;

            // Check that the extensions file exists
            if (!exists.sync(extConfigPath)) {
                throw [
                    `Could not find ${extender.EXT_CONFIG_NAME} for ${project}.`,
                    '',
                    `This is likely an issue w/ the deepforge extension (${project})`
                ].join('\n');
            }

            try {
                extConfig = JSON.parse(fs.readFileSync(extConfigPath, 'utf8'));
            } catch(e) {  // Invalid JSON
                throw `Invalid ${extender.EXT_CONFIG_NAME}: ${e}`;
            }

            // Try to add the extension to the project (using the extender)
            extType = extConfig.type;
            if (!extender.isSupportedType(extType)) {
                throw `Unrecognized extension type: "${extType}"`;
            }
            extender.install[extType](extConfig, {
                arg: project,
                root: extRoot,
                name: extProject
            }, !!isReinstall);

            return extConfig;
        });
};

extender.uninstall = function(name) {
    // Look up the extension in ~/.deepforge/extensions.json
    var extConfig = extender.getInstalledConfig(name);
    if (!extConfig) {
        throw `Extension "${name}" not found`;
    }

    // Run the uninstaller using the extender
    var extType = extConfig.type;
    extender.uninstall[extType](name);
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
    extender.install[typeCfg.type] = (config, project, isReinstall) => {
        var dstPath,
            pkgJsonPath = path.join(project.root, 'package.json'),
            pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')),
            content;

        // add the config to the current installed extensions of this type
        project = project || config.project;
        config.version = pkgJson.version;
        config.project = project;

        allExtConfigs[typeCfg.type] = allExtConfigs[typeCfg.type] || {};

        if (allExtConfigs[typeCfg.type][config.name] && !isReinstall) {
            // eslint-disable-next-line no-console
            console.error(`Extension ${config.name} already installed. Reinstalling...`);
        }

        allExtConfigs[typeCfg.type][config.name] = config;

        // copy the main script to src/plugins/Export/formats/<name>/<main>
        dstPath = makeTpl(typeCfg.targetDir)(config);
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

        saveExtensions();
    };

    // uninstall
    extender.uninstall['Export:Pipeline'] = name => {
        // Remove from config
        allExtConfigs[typeCfg.type] = allExtConfigs[typeCfg.type] || {};

        if (!allExtConfigs[typeCfg.type][name]) {
            // eslint-disable-next-line no-console
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
    targetDir: path.join(PLUGIN_ROOT, 'formats', '<%=name%>')
});

module.exports = extender;
