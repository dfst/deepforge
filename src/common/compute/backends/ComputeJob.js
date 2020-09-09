/* globals define */
define([], function() {

    class ComputeJob {
        constructor (hash, name='DeepForge Job') {
            this.name = name;
            this.hash = hash;
        }
    }

    class PipelineJob extends ComputeJob {
        constructor (hash, projectId, branch, core, job) {
            const execNode = core.getParent(job);
            const jobInfo = PipelineJob.getNodeMetadata(core, job);
            const execution = PipelineJob.getNodeMetadata(core, execNode);
            const name = `DeepForge Job: ${jobInfo.name} (${execution.name}) in ${projectId} (${branch})`;
            super(hash, name);
            this.job = jobInfo;
            this.execution = execution;
            this.branch = branch;
            this.projectId = projectId;
        }

        static getNodeMetadata (core, node) {
            const id = core.getPath(node);
            const name = core.getAttribute(node, 'name');
            return {id, name};
        }
    }

    return {ComputeJob, PipelineJob};
});
