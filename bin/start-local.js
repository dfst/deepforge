// Run `npm start` and listen for 'DeepForge' then start worker
var spawn = require('child_process').spawn,
    stdout = '',
    execJob,
    path = require('path'),
    env = {cwd: path.join(__dirname, '..'), NODE_ENV: process.env.NODE_ENV},
    workerJob = null,
    gmeConfig = require(__dirname + '/../config');

// Set the cache to the blob
if (gmeConfig.blob.type === 'FS') {
    process.env.DEEPFORGE_WORKER_CACHE = path.resolve(gmeConfig.blob.fsDir + '/wg-content');
}

// process.env.NODE_ENV = 'local';
execJob = spawn('node', [
    path.join(__dirname, '..', 'app.js')
], env);
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
