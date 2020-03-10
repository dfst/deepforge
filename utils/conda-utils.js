/*eslint-env node*/
/*eslint-disable no-console*/
'use strict';
const {spawnSync, spawn} = require('child_process'),
    os = require('os'),
    path = require('path'),
    fs = require('fs'),
    yaml = require('js-yaml'),
    CONDA_COMMAND = 'conda',
    SHELL = os.type() === 'Windows_NT' ? true: '/bin/bash',
    ENV_FILE = path.join(__dirname, '..', 'environment.yml');

const getCondaEnvs = function () {
    const envProcess = spawnSyncCondaProcess(['env', 'list']);
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
        envFileName = path.join(os.tmpdir(), 'deepforge.yml');
    }
    const envYamlString = yaml.safeDump(environment);
    fs.writeFileSync(envFileName, envYamlString, 'utf8');
    return envFileName;
};

const checkConda = function () {
    const conda = spawnSyncCondaProcess(['-V']);
    if (conda.status !== 0) {
        throw new Error(`Please install conda before continuing. ${conda.stderr.toString()}`);
    }
};


const createOrUpdateEnvironment = function (envFile, envName) {
    const env = yaml.safeLoad(fs.readFileSync(envFile, 'utf8'));
    if (envName && envName !== env.name) {
        env.name = envName;
        envFile = dumpYAML(env, envFile);
    }
    const createOrUpdate = envExists(env.name) ? 'update' : 'create';
    console.log(`Environment ${env.name} will be ${createOrUpdate}d.`);
    spawnCondaProcess(['env', createOrUpdate, '--file', envFile],
        `Successfully ${createOrUpdate}d the environment ${env.name}`);

};

const spawnCondaProcess = function (args, onCompleteMessage, onErrorMessage) {
    const condaProcess = spawn(CONDA_COMMAND, args, {
        shell: SHELL
    });

    condaProcess.stdout.pipe(process.stdout);
    condaProcess.stderr.pipe(process.stderr);
    condaProcess.on('exit', (code) => {
        if(code !== 0){
            throw new Error(onErrorMessage || 'Spawned conda process failed.');
        }
        console.log(onCompleteMessage || 'Spawned conda process executed successfully');
    });
};

const spawnSyncCondaProcess = function (args) {
    return spawnSync(CONDA_COMMAND, args, {
        shell: SHELL
    });
};

const runMain = function () {
    checkConda();
    createOrUpdateEnvironment(ENV_FILE);
};

const CondaManager = {checkConda, createOrUpdateEnvironment};

if (require.main === module) {
    runMain();
}

module.exports = CondaManager;