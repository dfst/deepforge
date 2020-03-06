// Run `npm start` and listen for 'DeepForge' then start worker
var spawn = require('child_process').spawn,
    stdout = '',
    execJob,
    os = require('os'),
    path = require('path'),
    yaml = require('js-yaml'),
    fs = require('fs'),
    env = {cwd: path.join(__dirname, '..'), NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH},
    workerJob = null,
    gmeConfig = require(__dirname + '/../config');

const DEEPFORGE_CONDA_ENV =
    yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'base-environment.yml'))).name;
const DEEPFORGE_SERVER_COMMAND =
    `${os.type() === 'Windows_NT' ? 'conda': 'source'} activate ${DEEPFORGE_CONDA_ENV} && node`;

// Set the cache to the blob
if  (gmeConfig.blob.type === 'FS') {
    process.env.DEEPFORGE_WORKER_CACHE = path.resolve(gmeConfig.blob.fsDir + '/wg-content');
}

// process.env.NODE_ENV = 'local';
execJob = spawn(DEEPFORGE_SERVER_COMMAND, [
    path.join(__dirname, '..', 'app.js')
], {
    env: env,
    shell: os.type() === 'Windows_NT'? true: '/bin/bash'
});
execJob.stdout.pipe(process.stdout);
execJob.stderr.pipe(process.stderr);

execJob.stdout.on('data', function(chunk) {
    if (!workerJob) {
        stdout += chunk;
        if (stdout.indexOf('DeepForge') > -1) {
            workerJob = spawn('npm', ['run', 'worker'], env);
            workerJob.stdout.pipe(process.stdout);
            workerJob.stderr.pipe(process.stderr);
            workerJob.on('close', code => code && process.exit(code));
        }
    }
});

execJob.on('close', code => code && process.exit(code));
