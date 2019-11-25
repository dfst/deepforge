'use strict';

const rm_rf = require('rimraf');
const babel = require('@babel/core');
const requirejs = require('requirejs');
const path = require('path');
const fs = require('fs');
const webgmeEngineSrc = path.join(path.dirname(require.resolve('webgme-engine')), 'src');
const JOB_FILES_DIR = `${__dirname}/../src/plugins/GenerateJob/templates/`;
const os = require('os');
const gmeConfig = require('../config');
const includeFile = path.join(__dirname, 'build-includes.js');
const _ = require('underscore');

function getFiles(dirname) {
    return fs.readdirSync(dirname)
        .map(name => {
            const fullpath = path.join(dirname, name);
            if (fs.statSync(fullpath).isDirectory()) {
                return getFiles(fullpath);
            } else {
                return [fullpath];
            }
        })
        .reduce((l1, l2) => l1.concat(l2), []);
}

async function generateIncludeFile() {
    const tplFile = includeFile.replace(/\.js/, '.ejs');
    const tpl = _.template(fs.readFileSync(tplFile, 'utf8'), '.ejs');
    const commonDir = path.join(__dirname, '..', 'src', 'common');
    const files = getFiles(path.join(commonDir, 'storage'))
        .map(name => {
            const relpath = `deepforge/${path.relative(commonDir, name)}`;
            if (!relpath.endsWith('.js')) {
                return 'text!' + relpath;
            }
            return relpath.replace(/\.js$/, '');
        });

    const content = tpl({files});
    fs.writeFileSync(includeFile, content);
    return content;
}

async function prepare() {
    const configFile = path.join(os.tmpdir(), 'gmeConfig.js');
    fs.writeFileSync(
        configFile,
        `define([], function() { return JSON.parse('${JSON.stringify(gmeConfig)}')});`
    );

    const end = await generateIncludeFile();

    const config = {
        baseUrl: path.join(__dirname, '../src'),
        paths: {
            'deepforge/gmeConfig': configFile.replace(/\.js$/, ''),
            deepforge: './common',
            blob: path.join(webgmeEngineSrc, 'common/blob'),
            common: path.join(webgmeEngineSrc, 'common'),
            client: path.join(webgmeEngineSrc, 'client'),

            urlparse: 'empty:',
            underscore: 'empty:',

            // common libs
            debug: 'empty:',
            q: 'empty:',
            superagent: 'empty:',
            text: path.join(webgmeEngineSrc, 'common/lib/requirejs/text'),
        },
        include: [
            '../utils/build-includes.js',
        ],
        wrap: {end},
        out: JOB_FILES_DIR + 'utils.build.js',
        onBuildRead(moduleName, path, content) {
            const results = babel.transform(content, {
                plugins: ['@babel/plugin-transform-runtime'],
                presets: ['@babel/preset-env'],
            });

            return results.code;
        },
        optimize: 'none',
        preserveLicenseComments: false,
        inlineText: true,
    };
    return {config, configFile};
}

async function doBuilds() {
    function callOptimizer(theConfig) {
        return new Promise((res, rej) => requirejs.optimize(theConfig, res, rej));
    }

    const {config, configFile} = await prepare();
    const result = await callOptimizer(config);
    await cleanUp(configFile);
    return result;
}

async function cleanUp(configFile) {
    rm_rf.sync(configFile);
    rm_rf.sync(includeFile);
}

if (require.main === module) {
    runMain();
}
async function runMain() {
    const data = await doBuilds();
    /* eslint-disable no-console*/
    console.log(data);
    /* eslint-enable no-console*/
}

module.exports = doBuilds;
