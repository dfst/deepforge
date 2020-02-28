/*eslint-env node*/
/*eslint-disable no-console*/
'use strict';
const {spawnSync, spawn} = require('child_process'),
    os = require('os'),
    path = require('path'),
    fs = require('fs'),
    yaml = require('js-yaml'),
    CONDA_COMMAND = 'conda';

const getCondaEnvs = function () {
    const envProcess = spawnSync(CONDA_COMMAND, ['env', 'list']);
    return envProcess.stdout.toString().split('\n')
        .filter(line => !!line && !line.startsWith('#'))
        .map((env) => {
            const [name, path] = env.split(/\s+/);  //eslint-disable-line no-unused-vars
            return name;
        }).filter(env => !!env);
};

const envExists = function (name) {
    const availableEnvs = getCondaEnvs();
    return availableEnvs.indexOf(name) > -1;
};

const dumpYAML = function (environment, envFileName) {
    if (!envFileName) {
        envFileName = path.join(os.tmpdir(), path.basename('deepforge.yml'));
    }
    const envYamlString = yaml.safeDump(environment);
    fs.writeFileSync(envFileName, envYamlString, 'utf8');
    return envFileName;
};

const checkConda = function () {
    const conda = spawnSync(CONDA_COMMAND, ['-V'], {
        shell: os.type() === 'Windows_NT' ? true : '/bin/bash'
    });
    if (conda.status !== 0) {
        console.log(`Please install conda before continuing. ${conda.stderr.toString()}`);
        process.exit(1);
    }
};


const createOrUpdateEnvironment = function (envFile) {
    const env = yaml.safeLoad(fs.readFileSync(envFile, 'utf8'));
    const createOrUpdate = envExists(env.name) > -1 ? 'update' : 'create';
    console.log(`Environment ${env.name} will be ${createOrUpdate}ed.`);
    if (process.env.DEEPFORGE_CONDA_ENV && process.env.DEEPFORGE_CONDA_ENV !== env.name) {
        env.name = process.env.DEEPFORGE_CONDA_ENV;
        envFile = dumpYAML(env, envFile);
    }
    const createOrUpdateProcess = spawn(CONDA_COMMAND, ['env', createOrUpdate, '--file', envFile], {
        shell: os.type === 'Windows_NT' ? true : '/bin/bash'
    });
    createOrUpdateProcess.stdout.pipe(process.stdout);
    createOrUpdateProcess.stderr.pipe(process.stderr);
    createOrUpdateProcess.on('close', () => {
        console.log(`Successfully ${createOrUpdate}ed the environment ${env.name}`);
    });
};

const runMain = function () {
    checkConda();
    createOrUpdateEnvironment(path.join(__dirname, '..', 'base-environment.yml'));
};

const CondaManager = {checkConda, createOrUpdateEnvironment};

if (require.main === module) {
    runMain();
}

module.exports = CondaManager;