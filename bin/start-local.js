// Run `npm start` and listen for 'DeepForge' then start worker
const spawn = require('child_process').spawn,
    path = require('path'),
    gmeConfig = require(__dirname + '/../config'),
    {SHELL, getDeepForgeServerCommand } = require('./deepforge');


const startLocal = function(useCondaInServer) {
    let stdout, workerJob=null;
    const env = {cwd: path.join(__dirname, '..'), NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH},
        deepForgeServerCommand = getDeepForgeServerCommand(useCondaInServer);
    // Set the cache to the blob
    if (gmeConfig.blob.type === 'FS') {
        process.env.DEEPFORGE_WORKER_CACHE = path.resolve(gmeConfig.blob.fsDir + '/wg-content');
    }

    // process.env.NODE_ENV = 'local';
    const execJob = spawn(deepForgeServerCommand, [
        path.join(__dirname, '..', 'app.js')
    ], {
        env: env,
        shell: SHELL
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
};

if(require.main === module) {
    let useCondaInServer;
    if(process.argv.includes('--help')){
        process.argv.pop();
    }
    if(process.argv.length < 3) {
        useCondaInServer = true;
    } else {
        useCondaInServer = process.argv[2] === 'true';
    }
    startLocal(useCondaInServer);
}
