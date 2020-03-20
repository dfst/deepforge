/*eslint-env node*/
/*eslint-disable no-console*/
'use strict';
const Conda = {};

const {promisify} = require('util'),
    childProcess = require('child_process'),
    exec = promisify(childProcess.exec),
    {spawnSync, spawn} = childProcess,
    os = require('os'),
    path = require('path'),
    fs = require('fs'),
    yaml = require('js-yaml'),
    CONDA_COMMAND = 'conda',
    SHELL = os.type() === 'Windows_NT' ? true: '/bin/bash';

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

Conda.check = function () {
    const conda = spawnSyncCondaProcess(['-V']);
    if (conda.status !== 0) {
        throw new Error(`Please install conda before continuing. ${conda.stderr.toString()}`);
    }
};


Conda.createOrUpdateEnvironment = async function (envFile, envName) {
    const env = yaml.safeLoad(fs.readFileSync(envFile, 'utf8'));
    if (envName && envName !== env.name) {
        env.name = envName;
        envFile = dumpYAML(env, envFile);
    }
    const createOrUpdate = envExists(env.name) ? 'update' : 'create';
    console.log(`Environment ${env.name} will be ${createOrUpdate}d.`);
    await Conda.spawn(`env ${createOrUpdate} --file ${envFile}`);
    console.log(`Successfully ${createOrUpdate}d the environment ${env.name}`);
};

Conda.spawn = function (command) {
    const condaProcess = spawn(CONDA_COMMAND, command.split(' '), {
        shell: SHELL
    });

    condaProcess.stdout.pipe(process.stdout);
    condaProcess.stderr.pipe(process.stderr);

    return new Promise((resolve, reject) => {
        condaProcess.on('exit', (code) => {
            if(code !== 0){
                return reject(code);
            }
            resolve();
        });
    });
};

Conda.export = async function (name) {
    const {stdout} = await exec(`${CONDA_COMMAND} env export -n ${name}`);
    return stdout;
};

const spawnSyncCondaProcess = function (args) {
    return spawnSync(CONDA_COMMAND, args, {
        shell: SHELL
    });
};

module.exports = Conda;
