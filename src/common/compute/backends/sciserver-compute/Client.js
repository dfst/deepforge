/* globals define */
define([
    '../ComputeClient',
    '../JobResults',
    'deepforge/storage/index',
    'common/util/assert',
    'module',
    'path',
    'node-fetch',
    'deepforge/sciserver-auth',
    'text!./files/prepare-and-run.sh',
], function(
    ComputeClient,
    JobResults,
    Storage,
    assert,
    module,
    path,
    fetch,
    login,
    PREPARE_AND_RUN,
) {
    const Headers = fetch.Headers;
    const POLL_INTERVAL = 1000;
    const SciServerClient = function(logger, blobClient, config) {
        ComputeClient.apply(this, arguments);
        this.username = config.username;
        this.password = config.password;
        this.computeDomain = config.computeDomain;
        this.previousJobState = {};
        this.consoleOutputLen = {};
    };

    SciServerClient.prototype = Object.create(ComputeClient.prototype);

    SciServerClient.prototype.createJob = async function(hash) {
        const filesInfo = await this._uploadFiles(hash);
        const job = await this._createJob(filesInfo);
        const jobInfo = {
            id: job.id,
            hash,
        };
        this._poll(jobInfo);

        return jobInfo;
    };

    SciServerClient.prototype._createConfig = async function(filesInfo) {
        const {dirname, volumePool, volume} = filesInfo;
        const domain = await this._getComputeDomain();
        const userVolumes = domain.userVolumes.map(volume => ({
            userVolumeId: volume.id,
            needsWriteAccess: SciServerClient.isWritable(volume),
        }));
        const filepath = `/home/idies/workspace/${volumePool}/${volume}/${dirname}`;

        return {
            command: `bash ${filepath}/prepare-and-run.sh ${filepath}`,
            dockerComputeEndpoint: domain.apiEndpoint,
            dockerImageName: 'SciServer Essentials',
            resultsFolderURI: '',
            submitterDID: 'DeepForge Job',
            volumeContainers: [],
            userVolumes: userVolumes
        };
    };

    SciServerClient.prototype._uploadFiles = async function(hash) {
        const dirname = `execution-files/${hash}`;
        const metadata = await this.blobClient.getMetadata(hash);
        const config =  {
            username: this.username,
            password: this.password,
            volume: `${this.username}/scratch`,
            volumePool: 'Temporary'
        };
        const storage = await Storage.getClient('sciserver-files', this.logger, config);
        const files = Object.entries(metadata.content)
            .map(async pair => {
                const [filename, metadata] = pair;
                const contents = await this.blobClient.getObject(metadata.content);
                const filepath = `${dirname}/${filename}`;
                await storage.putFile(filepath, contents);
            });

        await storage.putFile(`${dirname}/prepare-and-run.sh`, PREPARE_AND_RUN);
        await Promise.all(files);
        const filesInfo = Object.assign({}, config);
        filesInfo.dirname = dirname;
        return filesInfo;
    };

    SciServerClient.prototype._createJob = async function(filesInfo) {
        const config = await this._createConfig(filesInfo);
        const url = 'https://apps.sciserver.org/racm//jobm/rest/jobs/docker';

        const opts = {
            method: 'POST',
            body: JSON.stringify(config),
            headers: new Headers(),
        };

        opts.headers.append('Content-Type', 'application/json');

        const response = await this.fetch(url, opts);
        const {status} = response;
        if (status === 400) {
            throw new Error('Received "Bad Request" from SciServer. Is the token invalid?');
        } else if (status > 399) {
            const contents = await response.json();
            throw new Error(`SciServer Files request failed: ${contents.error}`);
        }
        return await response.json();
    };

    SciServerClient.prototype.fetch = async function(url, opts={}) {
        const token = await this.token();
        opts.headers = opts.headers || new Headers();
        opts.headers.append('X-Auth-Token', token);
        return fetch(url, opts);
    };

    SciServerClient.prototype.token = async function() {
        return login(this.username, this.password);
    };

    SciServerClient.prototype.getJobState = async function(jobInfo) {
        const url = 'https://apps.sciserver.org/racm//jobm/rest/dockerjobs';

        const opts = {
            headers: new Headers(),
        };
        opts.headers.append('X-Auth-Token', await this.token());

        const response = await fetch(url, opts);
        const {status} = response;
        if (status === 400) {
            throw new Error('Received "Bad Request" from SciServer. Is the token invalid?');
        } else if (status > 399) {
            const contents = await response.json();
            throw new Error(`SciServer Files request failed: ${contents.error}`);
        }

        const results = await response.json();
        return results.find(result => result.id === jobInfo.id);
    };

    SciServerClient.prototype.getJobResults = async function(jobInfo) {
        const result = await this.getJobState(jobInfo);
        if (result) {
            const status = SciServerClient.getStatus(result.status);
            return new JobResults(status);
        }
    };

    SciServerClient.prototype._poll = async function(jobInfo) {
        const state = await this.getJobState(jobInfo);
        if (state) {
            const status = SciServerClient.getStatus(state.status);
            const prevState = this.previousJobState[jobInfo.id];
            const prevStatus = prevState && SciServerClient.getStatus(prevState.status);

            if (prevStatus !== status) {
                this.emit('update', jobInfo.hash, status);
            }

            this.previousJobState[jobInfo.id] = state;
            if (this.isFinishedStatus(status)) {
                return this._onJobComplete(jobInfo, state);
            } else if (status === this.RUNNING) {  // update stdout
                const stdout = await this.getConsoleOutput(jobInfo);
                const prevLen = this.consoleOutputLen[jobInfo.id] || 0;

                this.emit('data', jobInfo.hash, stdout.substring(prevLen));
                this.consoleOutputLen[jobInfo.id] = stdout.length;
            }
        }

        return setTimeout(() => this._poll(jobInfo), POLL_INTERVAL);
    };

    SciServerClient.prototype._onJobComplete = async function(jobInfo, state) {
        const {hash} = jobInfo;
        const stdout = await this.getConsoleOutput(hash);
        this.emit('data', hash, stdout);

        const status = SciServerClient.getStatus(state.status);
        const results = new JobResults(status);

        if (status === this.SUCCESS) {
            // TODO: Move the debug files to the blob
        }

        this._deleteFileDir(state);
        this.emit('end', hash, results);
        delete this.previousJobState[jobInfo.id];
        delete this.consoleOutputLen[jobInfo.id];
    };

    SciServerClient.prototype.cancelJob = async function(jobInfo) {
        const {id} = jobInfo;
        const url = `https://apps.sciserver.org/racm/jobm/rest/jobs/${id}/cancel`;
        await this.fetch(url, {method: 'POST'});
    };

    SciServerClient.prototype.getResultsInfo = async function(jobInfo) {
        const text = await this._getFile(jobInfo, 'results.json');
        assert(text, 'Metadata about result types not found.');
        return JSON.parse(text);
    };

    SciServerClient.prototype.getStatus = async function(jobInfo) {
        const results = await this.getJobResults(jobInfo);
        return results && results.status;
    };

    SciServerClient.prototype.getConsoleOutput = async function(jobInfo) {
        return await this._getFile(jobInfo, 'stdout.txt') || '';
    };

    SciServerClient.prototype._getFile = async function(jobInfo, filename) {
        const state = await this.getJobState(jobInfo);
        if (state) {
            const baseUrl = 'https://apps.sciserver.org/fileservice/api/file/';
            const filepath = state.resultsFolderURI.replace(/\/?$/, '/') + filename;
            const fileUrl = baseUrl + this._getEncodedFilePath(filepath);

            const response = await this.fetch(fileUrl);
            return await response.text();
        }
    };

    SciServerClient.prototype._deleteFileDir = async function(state) {
        const baseUrl = 'https://apps.sciserver.org/fileservice/api/data/';
        const filepath = state.command.split(' ').pop();
        const fileUrl = baseUrl + this._getEncodedFilePath(filepath);
        const response = await this.fetch(fileUrl, {method: 'DELETE'});
        return await response.text();
    };

    SciServerClient.prototype._getEncodedFilePath = function(filepath) {
        const dirs = filepath.split('/').slice(4);
        const filename = dirs.pop();
        const drive = dirs.slice(0, 3).join('/') + '/';
        const dirname = '/' + dirs.slice(3).join('/');

        return drive + encodeURIComponent(dirname) + '/' + filename;
    };

    SciServerClient.prototype._getComputeDomain = async function() {
        const url = 'https://apps.sciserver.org/racm/jobm/rest/computedomains?batch=true';
        const response = await this.fetch(url);
        const domains = await response.json();

        const domain = domains.find(domain => domain.name === this.computeDomain);
        assert(domain, `Compute domain not found: ${this.computeDomain}`);
        return domain;
    };

    SciServerClient.getStatus = function(code) {
        const index = Math.log2(code);
        return SciServerClient.STATUSES[index];
    };

    SciServerClient.STATUSES = [
        ComputeClient.prototype.QUEUED,
        ComputeClient.prototype.QUEUED,
        ComputeClient.prototype.QUEUED,
        ComputeClient.prototype.RUNNING,
        ComputeClient.prototype.RUNNING,
        ComputeClient.prototype.SUCCESS,
        ComputeClient.prototype.FAILED,
        ComputeClient.prototype.CANCELED,
    ];

    SciServerClient.isWritable = function(volume) {
        return volume.allowedActions.includes('write');
    };

    return SciServerClient;
});
