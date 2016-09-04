var path = require('path'),
    Q = require('q'),
    fs = require('fs'),
    exists = require('exists-file'),
    NO_LOG_FOUND = '';

var JobLogManager = function(logger, config) {
    this.rootDir = path.join(config.blob.fsDir, 'log-storage');
    this.logger = logger.fork('JobLogManager');
    this._onCopyFinished = {};
};

JobLogManager.prototype._getFilePath = function(jobInfo) {
    var jobId = jobInfo.job.replace(/\//g, '_'),
        filename = `${jobId}.txt`;

    return path.join(this.rootDir, jobInfo.project, jobInfo.branch, filename);
};

JobLogManager.prototype.exists = function(jobInfo) {
    var filename = this._getFilePath(jobInfo);
    return Q.nfcall(exists, filename);
};

JobLogManager.prototype.mkdirIfNeeded = function(dir) {
    return Q.nfcall(exists, dir).then(exist => {
        if (!exist) {
            this.logger.debug('making dir:', dir);
            return Q.nfcall(fs.mkdir, dir)
                .catch(() => this.logger.debug(`dir already created: ${dir}`));
        }
    });
};

JobLogManager.prototype._copyFile = function(src, dst) {
    return this.mkdirIfNeeded(path.dirname(dst)).then(() => {
        var deferred = Q.defer(),
            stream = fs.createReadStream(src).pipe(fs.createWriteStream(dst));

        stream.on('error', deferred.reject);
        stream.on('finish', deferred.resolve);

        return deferred.promise;
    });
};

// Copy one branch info to the next
// Could optimize this to symlink until data appended...
JobLogManager.prototype.migrate = function(migrationInfo, jobIds) {
    // Recursively copy the srcBranch dir to the dstBranch dir
    // Should probably use streams...
    // Need to block appends to the given files so they are not written
    // to until they have finished copying...
    // TODO
    var jobs,
        src,
        dst,
        i;

    for (i = jobIds.length; i--;) {
        this._onCopyFinished[jobIds[i]] = [];
    }

    // Copy the job files and evaluate each of the finish functions
    this.logger.info('migrating from ' + migrationInfo.srcBranch + ' to '+ migrationInfo.dstBranch);
    return Q.all(jobIds.map(jobId => {
        src = this._getFilePath({
            project: migrationInfo.project,
            branch: migrationInfo.srcBranch,
            job: jobId
        });
        dst = this._getFilePath({
            project: migrationInfo.project,
            branch: migrationInfo.dstBranch,
            job: jobId
        });
        return this._copyFile(src, dst).then(() => {
            jobs = this._onCopyFinished[jobId];
            for (var j = jobs.length; j--;) {
                jobs[j]();
            }
        });
    }));
};

JobLogManager.prototype.appendTo = function(jobInfo, logs) {
    var filename = this._getFilePath(jobInfo),
        branchDirname = path.dirname(filename),
        projDirname = path.dirname(branchDirname);

    this.logger.info(`Appending content to ${filename}`);
    // Make directory if needed
    return this.mkdirIfNeeded(this.rootDir)
        .then(() => this.mkdirIfNeeded(projDirname))
        .then(() => this.mkdirIfNeeded(branchDirname))
        .then(() => Q.nfcall(fs.appendFile, filename, logs));
};

JobLogManager.prototype.getLog = function(jobInfo) {
    var filename = this._getFilePath(jobInfo);

    this.logger.info(`Getting log content to ${filename}`);
    return this.exists(jobInfo)
        .then(exists => {
            if (exists) {
                return Q.nfcall(fs.readFile, filename);
            }
            return NO_LOG_FOUND;
        });
};

JobLogManager.prototype.delete = function(jobInfo) {
    var filename = this._getFilePath(jobInfo);

    return this.exists(jobInfo)
        .then(exists => {
            if (exists) {
                this.logger.debug(`Removing file ${filename}`);
                return Q.nfcall(fs.unlink, filename);
            }
            this.logger.info(`${filename} doesn't exist. No need to delete...`);
        });
};

module.exports = JobLogManager;
