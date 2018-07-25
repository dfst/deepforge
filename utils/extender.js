// Utility for applying and removing deepforge extensions
// This utility is run by the cli when executing:
//
//     deepforge extensions add <project>
//     deepforge extensions remove <name>
//
const path = require('path');
const fs = require('fs');
const npm = require('npm');
const Q = require('q');
const rm_rf = require('rimraf');
const exists = require('exists-file');
const makeTpl = require('lodash.template');
const HOME_DIR = require('os').homedir();
const CONFIG_DIR = path.join(HOME_DIR, '.deepforge');
const EXT_CONFIG_NAME = 'deepforge-extension.json';
const EXTENSION_REGISTRY_NAME = 'extensions.json';
const extConfigPath = path.join(CONFIG_DIR, EXTENSION_REGISTRY_NAME);
const webgme = require('webgme-cli');

let values = obj => Object.keys(obj).map(key => obj[key]);
let allExtConfigs;

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

extender.getInstalledConfigType = function(name) {
    var type = Object.keys(allExtConfigs).find(type => {
        let typeGroup = allExtConfigs[type];
        return !!typeGroup[name];
    });
    return type;
};


extender.install = function(projectName, isReinstall) {
    // Install the project
    return Q.ninvoke(npm, 'load', {})
        .then(() => Q.ninvoke(npm, 'install', projectName))
        .then(results => {
            let installed = results[0];
            // FIXME: fails if already installed
            let [extProject, extRoot] = installed.pop();

            // Check for the extensions.json in the project (look up type, etc)
            var extConfigPath = path.join(extRoot, extender.EXT_CONFIG_NAME),
                extConfig,
                extType;

            // Check that the extensions file exists
            if (!exists.sync(extConfigPath)) {
                throw [
                    `Could not find ${extender.EXT_CONFIG_NAME} for ${projectName}.`,
                    '',
                    `This is likely an issue with the deepforge extension (${projectName})`
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
            // add project info to the config
            let project = {
                arg: projectName,
                root: extRoot,
                name: extProject
            };
            let pkgJsonPath = path.join(project.root, 'package.json');
            let pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            project = project || extConfig.project;
            extConfig.version = pkgJson.version;
            extConfig.project = project;

            allExtConfigs[extType] = allExtConfigs[extType] || {};
            isReinstall = isReinstall || !!allExtConfigs[extType][extConfig.name];
            if (isReinstall) {
                // eslint-disable-next-line no-console
                console.error(`Extension ${extConfig.name} already installed. Reinstalling...`);
            }

            allExtConfigs[extType][extConfig.name] = extConfig;
            return Q(extender.install[extType](extConfig, project, !!isReinstall))
                .then(config => {
                    extConfig = config || extConfig;
                    // Update the deployment config
                    allExtConfigs[extType][extConfig.name] = extConfig;
                    persistExtConfig();

                    return extConfig;
                });
        });
};

extender.uninstall = function(name) {
    // Look up the extension in ~/.deepforge/extensions.json
    let extType = extender.getInstalledConfigType(name);
    if (!extType) {
        throw `Extension "${name}" not found`;
    }

    // Run the uninstaller using the extender
    let extConfig = allExtConfigs[extType][name];
    delete allExtConfigs[extType][name];
    extender.uninstall[extType](name, extConfig);
    persistExtConfig();
};

let updateTemplateFile = (tplPath, type) => {
    let installedExts = values(allExtConfigs[type]),
        formatTemplate = makeTpl(fs.readFileSync(tplPath, 'utf8')),
        formatsIndex = formatTemplate({path: path, extensions: installedExts}),
        dstPath = tplPath.replace(/\.ejs$/, '');

    fs.writeFileSync(dstPath, formatsIndex);
};

var makeInstallFor = function(typeCfg) {
    var saveExtensions = () => {
        // regenerate the format.js file from the template
        var installedExts = values(allExtConfigs[typeCfg.type]),
            formatTemplate = makeTpl(fs.readFileSync(typeCfg.template, 'utf8')),
            formatsIndex = formatTemplate({path: path, extensions: installedExts}),
            dstPath = typeCfg.template.replace(/\.ejs$/, '');

        fs.writeFileSync(dstPath, formatsIndex);
    };

    // Given a...
    //  - template file
    //  - extension type
    //  - target path tpl
    // create the installation/uninstallation functions
    extender.install[typeCfg.type] = (config, project/*, isReinstall*/) => {
        var dstPath,
            pkgJsonPath = path.join(project.root, 'package.json'),
            pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')),
            content;

        // add the config to the current installed extensions of this type
        project = project || config.project;
        config.version = pkgJson.version;
        config.project = project;

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
    extender.uninstall[typeCfg.type] = (name, config) => {
        let dstPath = makeTpl(typeCfg.targetDir)(config);

        // Remove the dstPath
        rm_rf.sync(dstPath);

        // Re-generate template file
        saveExtensions();
    };
};

//var PLUGIN_ROOT = path.join(__dirname, '..', 'src', 'plugins', 'Export');
//makeInstallFor({
    //type: 'Export:Pipeline',
    //template: path.join(PLUGIN_ROOT, 'format.js.ejs'),
    //targetDir: path.join(PLUGIN_ROOT, 'formats', '<%=name%>')
//});

const LIBRARY_ROOT = path.join(__dirname, '..', 'src', 'visualizers',
    'panels', 'ForgeActionButton');
makeInstallFor({
    type: 'Library',
    template: path.join(LIBRARY_ROOT, 'Libraries.json.ejs'),
    targetDir: path.join(LIBRARY_ROOT)
});


// Add the extension type for another domain/library
const libraryType = 'Library';
const LIBRARY_TEMPLATE_PATH = path.join(__dirname, '..', 'src', 'visualizers',
    'panels', 'ForgeActionButton', 'Libraries.json.ejs');
extender.install[libraryType] = (config, project/*, isReinstall*/) => {
    return webgme.all.import(project.arg)  // import the seed and stuff
        .then(() => {
            // Add the initCode to the config
            config.initCode = config.initCode || '';
            if (config.initCode) {
                const initCodePath = path.join(project.root, config.initCode);
                config.initCode = fs.readFileSync(initCodePath, 'utf8');
            }
            return updateTemplateFile(LIBRARY_TEMPLATE_PATH, libraryType);
        });
};

extender.uninstall[libraryType] = (/*name, config*/) => {
    // update the Libraries.json file
    updateTemplateFile(LIBRARY_TEMPLATE_PATH, libraryType);
};

module.exports = extender;
