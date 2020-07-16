/*globals define*/
'use strict';
define([
    'common/util/assert',
    'deepforge/Constants',
    './metadata/index',
], function (
    assert,
    CONSTANTS,
    Metadata,
) {

    const ExecuteJob = function () {};

    ExecuteJob.prototype.initializeMetadata = async function (job) {
        const nodeId = this.core.getPath(job);
        this.lastAppliedCmd[nodeId] = 0;
        const metadata = await this.getMetadataNodes(job);
        await Promise.all(metadata.map(node => this.resetMetadataNode(node, job)));
    };

    ExecuteJob.prototype.clearOldMetadata = async function (job) {
        const nodeId = this.core.getPath(job);
        const node = await this.getOperation(job);

        if (!this.isLocalOperation(node)) {
            // Remove created nodes left over from resumed job
            const metadata = await this.getMetadataNodes(job);

            const lastId = this.lastAppliedCmd[nodeId];
            metadata
                .filter(node => +this.core.getAttribute(node, 'id') > lastId)
                .forEach(oldMetadata => {
                    this.core.deleteNode(oldMetadata);
                });

            delete this.lastAppliedCmd[nodeId];
            this.core.delAttribute(job, 'jobInfo');
        }
    };

    ExecuteJob.prototype.resetMetadataNode = async function (node, job) {
        const children = await this.core.loadChildren(node);
        children.forEach(child => this.core.deleteNode(child));

        const attributes = this.core.getAttributeNames(node)
            .filter(attr => attr !== 'id');
        attributes.forEach(attr => this.core.delAttribute(node, attr));

        const op = await this.getOperation(job);
        await this.recordProvenance(node, op);
    };

    ExecuteJob.prototype.getMetadataNodes = async function (job) {
        return (await this.core.loadChildren(job))
            .filter(node => this.core.isTypeOf(node, this.META.Metadata));
    };

    ExecuteJob.prototype.parseForMetadataCmds = async function (job, lines, skip) {
        var jobId = this.core.getPath(job),
            args,
            result = [],
            cmdCnt = 0,
            ansiRegex = /\[\d+(;\d+)?m/g,
            hasMetadata = false,
            trimStartRegex = new RegExp(CONSTANTS.START_CMD + '.*'),
            matches,
            content,
            cmd;

        for (let i = 0; i < lines.length; i++) {
            // Check for a deepforge command
            if (lines[i].indexOf(CONSTANTS.START_CMD) !== -1) {
                matches = lines[i].replace(ansiRegex, '').match(trimStartRegex);
                for (var m = 0; m < matches.length; m++) {
                    cmdCnt++;
                    args = matches[m].split(/\s+/);
                    args.shift();
                    cmd = args[0];
                    content = matches[m].substring(matches[m].indexOf(cmd) + cmd.length);
                    if (!skip || cmdCnt >= this.lastAppliedCmd[jobId]) {
                        this.lastAppliedCmd[jobId]++;
                        await this.onMetadataCommand(
                            job,
                            cmd,
                            this.lastAppliedCmd[jobId],
                            JSON.parse(content)
                        );
                        hasMetadata = true;
                    }
                }
            } else {
                result.push(lines[i]);
            }
        }
        return {
            stdout: result.join('\n'),
            hasMetadata: hasMetadata
        };
    };

    ExecuteJob.prototype.onMetadataCommand = async function (job, cmd, id, content) {
        const MetadataClass = Metadata.getClassForCommand(cmd);
        const metadata = await this.getMetadataNodes(job);
        const node = metadata.find(node => this.core.getAttribute(node, 'id')) ||
            await this.createNodeForMetadata(MetadataClass, job, id);

        const md = new MetadataClass(node, this.core, this.META);
        await md.update(content);
    };

    ExecuteJob.prototype.createNodeForMetadata = async function (MetadataClass, job, id) {
        const op = await this.getOperation(job);
        const base = this.META[MetadataClass.getMetaType()];
        const msg = `Metadata type not found for ${MetadataClass.name}: ` +
            `${MetadataClass.getMetaType()}`;

        assert(base, msg);

        const node = this.core.createNode({base, parent: job});
        this.core.setAttribute(node, 'id', id);
        await this.recordProvenance(node, op);
        return node;
    };

    return ExecuteJob;
});
