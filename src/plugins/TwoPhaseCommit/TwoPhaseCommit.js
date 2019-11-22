/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/PluginBase',
    './TwoPhaseCore',
    './CreatedNode',
    'common/storage/constants',
    'q',
    'common/util/assert',
    'text!./metadata.json',
], function(
    PluginBase,
    TwoPhaseCore,
    CreatedNode,
    STORAGE_CONSTANTS,
    Q,
    assert,
    pluginMetadata,
) {

    pluginMetadata = JSON.parse(pluginMetadata);

    const TwoPhaseCommit = function() {
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.forkNameBase = null;
        this._currentSave = Promise.resolve();
    };

    TwoPhaseCommit.INVOKE_ERR = 'TwoPhaseCommit is an abstract plugin and not meant for direct usage.';
    TwoPhaseCommit.metadata = pluginMetadata;
    TwoPhaseCommit.prototype = Object.create(PluginBase.prototype);
    TwoPhaseCommit.prototype.constructor = TwoPhaseCommit;

    TwoPhaseCommit.prototype.configure = function () {
        PluginBase.prototype.configure.apply(this, arguments);
        const logger = this.logger.fork('TwoPhaseCore');
        this.core = new TwoPhaseCore(logger, this.core);
    };

    TwoPhaseCommit.prototype.main = function (/*callback*/) {
        throw new Error(TwoPhaseCommit.INVOKE_ERR);
    };

    TwoPhaseCommit.prototype.updateForkName = async function (basename) {
        basename = basename + '_fork';
        basename = basename.replace(/[- ]/g, '_');
        const branches = await this.project.getBranches();
        const names = Object.keys(branches);
        let name = basename,
            i = 2;

        while (names.indexOf(name) !== -1) {
            name = basename + '_' + i;
            i++;
        }

        this.forkName = name;
    };

    // Override 'save' to notify the user on fork
    TwoPhaseCommit.prototype.save = function (msg) {
        const changes = this.core.getStagedChanges();

        this._currentSave = this._currentSave
            .then(() => this.updateForkName(this.forkNameBase))
            .then(() => this.core.apply(this.rootNode, changes))
            .then(() => PluginBase.prototype.save.call(this, msg))
            .then(async result => {
                this.logger.info(`Save finished w/ status: ${result.status}`);
                if (result.status === STORAGE_CONSTANTS.FORKED) {
                    await this.onSaveForked(result.forkName);
                } else if (result.status === STORAGE_CONSTANTS.MERGED ||
                    result.status === STORAGE_CONSTANTS.SYNCED) {
                    this.logger.debug('Applied changes successfully. About to update plugin nodes');
                }
                await this.updateNodes();
                this.core.discard(changes);
            });

        return this._currentSave;
    };

    TwoPhaseCommit.prototype.onSaveForked = function (forkName) {
        var name = this.core.getAttribute(this.activeNode, 'name'),
            msg = `"${name}" execution has forked to "${forkName}"`;

        this.currentForkName = forkName;
        this.sendNotification(msg);
    };

    TwoPhaseCommit.prototype.updateNodes = async function (hash) {
        const activeId = this.core.getPath(this.activeNode);

        hash = hash || this.currentHash;
        const commitObject = await Q.ninvoke(this.project, 'loadObject', hash);
        this.rootNode = await this.core.loadRoot(commitObject.root);
        this.activeNode = await this.core.loadByPath(this.rootNode, activeId);

        const caches = this.getNodeCaches();
        for (let i = caches.length; i--;) {
            await this.updateExistingNodeDict(caches[i]);
        }
    };

    TwoPhaseCommit.prototype.getNodeCaches = function () {
        return [this.META];
    };

    /**
     * Update a dictionary of *existing* nodes to the node instances in the
     * current commit.
     */
    TwoPhaseCommit.prototype.updateExistingNodeDict = async function (dict, keys) {
        keys = keys || Object.keys(dict);

        for (let i = keys.length; i--;) {
            const key = keys[i];
            const oldNode = dict[key] instanceof CreatedNode ?
                await dict[key].toGMENode(this.rootNode, this.core) : dict[key];

            const nodePath = this.core.getPath(oldNode);
            dict[key] = await this.core.loadByPath(this.rootNode, nodePath);
        }
    };

    return TwoPhaseCommit;
});
