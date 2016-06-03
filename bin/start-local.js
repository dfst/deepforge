// Run `npm start` and listen for 'DeepForge' then start worker
var spawn = require('child_process').spawn,
    stdout = '',
    execJob,
    workerJob = null;

execJob = spawn('npm', [
    'start'
]);
execJob.stdout.pipe(process.stdout);
execJob.stderr.pipe(process.stderr);

execJob.stdout.on('data', function(chunk) {
    if (!workerJob) {
        stdout += chunk;
        if (stdout.indexOf('DeepForge') > -1) {
            workerJob = spawn('npm', ['run', 'worker']);
            workerJob.stdout.pipe(process.stdout);
            workerJob.stderr.pipe(process.stderr);
            workerJob.on('close', code => code && process.exit(code));
        }
    }
});

execJob.on('close', code => code && process.exit(code));
