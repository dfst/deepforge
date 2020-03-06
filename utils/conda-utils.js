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


const createOrUpdateEnvironment = function (envFile) {
    const env = yaml.safeLoad(fs.readFileSync(envFile, 'utf8'));
    if (process.env.DEEPFORGE_CONDA_ENV && process.env.DEEPFORGE_CONDA_ENV !== env.name) {
        env.name = process.env.DEEPFORGE_CONDA_ENV;
        envFile = dumpYAML(env, envFile);
    }
    const createOrUpdate = envExists(env.name) > -1 ? 'update' : 'create';
    console.log(`Environment ${env.name} will be ${createOrUpdate}d.`);
    spawnCondaProcess(['env', createOrUpdate, '--file', envFile],
        `Successfully ${createOrUpdate}ed the environment ${env.name}`);

};

const updateDependencies = function (envFile, dependencies, create=false, dump=true) {
    const env = yaml.safeLoad(fs.readFileSync(envFile));
    const exists = envExists(env.name);
    if(!exists && create){
        createOrUpdateEnvironment(envFile);
    } else if(!exists && !create) {
        console.log(`Cannot update dependencies for ${env.name}, please use create=true.`);
        throw new Error(`Cannot update dependencies for ${env.name}, please use create=true.`);
    } else {
        // ToDo: Handle Channel Priorities
        if(dependencies.channels){
            env.channels = env.channels.concat(dependencies.channels);
        }
        if(dependencies.packages.pip){
            env.dependencies[env.dependencies.length - 1].pip.concat(dependencies.packages.pip);
        }
        if(dependencies.packages.conda){
            dependencies.packages.conda.forEach(dep => env.dependencies.unshift(dep));
        }
    }
    const envYamlString = yaml.safeDump(env);
    let envFileName = envFile;
    if(!dump){
        envFileName = path.join(os.tmpdir(), path.basename(envFile));
    }
    fs.writeFileSync(envFileName, envYamlString, 'utf8');
    createOrUpdateEnvironment(envFileName);
};


const spawnCondaProcess = function (args, onCompleteMessage, onErrorMessage) {
    const condaProcess = spawn(CONDA_COMMAND, args, {
        shell: os.type === 'Windows_NT' ? true : '/bin/bash'
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
        shell: os.type() === 'Windows_NT' ? true : '/bin/bash'
    });
};

const runMain = function () {
    checkConda();
    createOrUpdateEnvironment(path.join(__dirname, '..', 'base-environment.yml'));
};

const CondaManager = {checkConda, createOrUpdateEnvironment, updateDependencies};

if (require.main === module) {
    runMain();
}

module.exports = CondaManager;