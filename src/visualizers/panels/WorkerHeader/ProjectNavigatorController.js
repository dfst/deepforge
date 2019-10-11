/* globals define, WebGMEGlobal */
define([
    'js/Dialogs/Projects/ProjectsDialog',
    'js/Loader/ProgressNotification',
    './ComputeDialog',
    'js/Panels/Header/ProjectNavigatorController',
    'js/Dialogs/Confirm/ConfirmDialog',
    'js/Dialogs/Merge/MergeDialog',
    'js/Dialogs/AddCommits/AddCommitsDialog',
    'q',
    'js/Utils/SaveToDisk',
    'blob/BlobClient',
], function(
    ProjectsDialog,
    ProgressNotification,
    ComputeDialog,
    GMEProjectNavigatorController,
    ConfirmDialog,
    MergeDialog,
    AddCommitsDialog,
    Q,
    SaveToDisk,
    BlobClient,
) {
    'use strict';
    var ProjectNavigatorController = function() {
        GMEProjectNavigatorController.apply(this, arguments);
    };

    ProjectNavigatorController.prototype = Object.create(GMEProjectNavigatorController.prototype);

    ProjectNavigatorController.prototype.initialize = function () {
        var self = this,
            newProject,
            manageProjects;


        // initialize model structure for view
        self.$scope.navigator = {
            items: [],
            separator: true
        };


        manageProjects = function (/*data*/) {
            var pd = new ProjectsDialog(self.gmeClient);
            pd.show();
        };
        newProject = function (data) {
            var pd = new ProjectsDialog(self.gmeClient, true, data.newType);
            pd.show();
        };
        self.userId = WebGMEGlobal.userInfo._id;

        const viewCompute = function() {
            // Create the worker dialog
            const dialog = new ComputeDialog(self.logger);
            dialog.show();
        };

        // initialize root menu
        // projects id is mandatory
        if (self.config.disableProjectActions === false) {
            self.root.menu = [
                {
                    id: 'top',
                    items: [
                        {
                            id: 'manageProject',
                            label: 'Manage projects ...',
                            iconClass: 'glyphicon glyphicon-folder-open',
                            action: manageProjects,
                            actionData: {}
                        },
                        {
                            id: 'newProject',
                            label: 'New project ...',
                            disabled: WebGMEGlobal.userInfo.canCreate !== true,
                            iconClass: 'glyphicon glyphicon-plus',
                            action: newProject,
                            actionData: {newType: 'seed'}
                        },
                        {
                            id: 'importProject',
                            label: 'Import project ...',
                            disabled: WebGMEGlobal.userInfo.canCreate !== true,
                            iconClass: 'glyphicon glyphicon-import',
                            action: newProject,
                            actionData: {newType: 'import'}
                        },
                        {
                            id: 'viewCompute',
                            label: 'View compute ...',
                            iconClass: 'glyphicon glyphicon-cloud',
                            action: viewCompute
                        }
                    ]
                },
                {
                    id: 'projects',
                    label: 'Recent projects',
                    totalItems: 20,
                    items: [],
                    showAllItems: manageProjects
                }
            ];
        }

        self.initWithClient();

        // only root is selected by default
        self.$scope.navigator = {
            items: self.config.disableProjectActions ? [] : [self.root],
            separator: true
        };
    };

    ProjectNavigatorController.prototype.addBranch = function (projectId, branchId, branchInfo, noUpdate) {
        var self = this,
            i,
            deleteBranchItem,
            mergeBranchItem,
            addCommits,
            undoLastCommitItem,
            redoLastUndoItem;

        if (self.projects.hasOwnProperty(projectId) === false) {
            self.logger.warn('project is not in the list yet: ', projectId);
            return;
        }

        if (self.projects[projectId].disabled) {
            // do not show any branches if the project is disabled
            return;
        }

        function showBranchHistory(data) {
            self.showHistory(data);
        }

        function exportBranch(data) {
            const progress = ProgressNotification.start('<strong>Exporting </strong> project ...');
            const complete = () => {
                clearInterval(progress.intervalId);
                setTimeout(() => progress.note.close(), 5000);
            };

            self.exportBranch(data)
                .then(result => {
                    const {filename, url} = result;
                    SaveToDisk.saveUrlToDisk(url);
                    progress.note.update({
                        message: '<strong>Exported </strong> project <a href="' +
                        url + '" target="_blank">' + filename + '</a>',
                        progress: 100,
                        type: 'success'
                    });
                    complete();
                })
                .catch(err => {
                    progress.note.update({
                        message: '<strong>Failed to export: </strong>' + err.message,
                        type: 'danger',
                        progress: 100
                    });
                    complete();
                });
        }

        function deleteBranch(data) {
            var deleteBranchModal = new ConfirmDialog(),
                deleteItem = WebGMEGlobal.getProjectDisplayedNameFromProjectId(data.projectId) +
                    '  ::  ' + data.branchId;
            deleteBranchModal.show({deleteItem: deleteItem}, function () {
                self.gmeClient.deleteBranch(data.projectId,
                    data.branchId,
                    data.branchInfo.branchHash,
                    function (err) {
                        if (err) {
                            self.logger.error('Failed deleting branch of project.',
                                data.projectId, data.branchId, err);
                        } else {
                            self.removeBranch(data.projectId, data.branchId);
                        }
                    }
                );
            });

        }

        function mergeBranch(data) {
            var progress = ProgressNotification.start('<strong>Merging </strong> branch ' +
                data.branchId + ' into ' + self.$scope.navigator.items[self.navIdBranch].id + '...');

            if (data.projectId !== self.gmeClient.getActiveProjectId()) {
                self.logger.error(new Error('Cannot merge branch from a different project..'));
                clearInterval(progress.intervalId);
                progress.note.update({
                    message: '<strong>Failed to merge: </strong> cannot merge branch from a different project.',
                    type: 'danger',
                    progress: 100
                });
            } else {
                self.gmeClient.autoMerge(data.projectId,
                    data.branchId, self.$scope.navigator.items[self.navIdBranch].id,
                    function (err, result) {
                        clearInterval(progress.intervalId);
                        progress.note.update('progress', 100);
                        progress.note.close();
                        var mergeDialog = new MergeDialog(self.gmeClient);
                        if (err) {
                            self.logger.error('merge of branch failed', err);
                            mergeDialog.show(err);
                            return;
                        }

                        if (result && result.conflict && result.conflict.items.length > 0) {
                            //TODO create some user-friendly way to show this type of result
                            self.logger.error('merge ended in conflicts', result);
                            mergeDialog.show('merge ended in conflicts', result);
                        } else {
                            self.logger.debug('successful merge');
                            mergeDialog.show(null, result);
                        }
                    }
                );
            }
        }

        function selectBranch(data) {
            self.selectBranch(data);
        }

        deleteBranchItem = {
            id: 'deleteBranch',
            label: 'Delete branch',
            iconClass: 'glyphicon glyphicon-remove',
            disabled: self.projects[projectId].projectIsReadOnly,
            action: deleteBranch,
            actionData: {
                projectId: projectId,
                branchId: branchId,
                branchInfo: branchInfo
            }
        };

        mergeBranchItem = {
            id: 'mergeBranch',
            label: 'Merge into current branch',
            iconClass: 'fa fa-share-alt fa-rotate-90',
            disabled: self.projects[projectId].projectIsReadOnly,
            action: mergeBranch,
            actionData: {
                projectId: projectId,
                branchId: branchId
            }
        };

        addCommits = {
            id: 'addCommits',
            label: 'Add external commits ...',
            iconClass: 'glyphicon glyphicon-fast-forward',
            disabled: true,
            action: function (data) {
                self.gmeClient.getBranches(data.projectId, function (err, branches) {
                    if (err) {
                        self.logger.error(new Error('Failed getting branches before adding commits'));
                        return;
                    }

                    var dialog = new AddCommitsDialog(self.gmeClient, WebGMEGlobal.gmeConfig, branches);
                    dialog.show(data);
                });
            },
            actionData: {
                projectId: projectId,
                branchName: branchId
            }
        };

        undoLastCommitItem = {
            id: 'undoLastCommit',
            label: 'Undo last commit',
            iconClass: 'fa fa-reply',
            disabled: true, // TODO: set this from handler to enable/disable
            action: function (actionData) {
                self.gmeClient.undo(actionData.branchId, function (/*err*/) {
                });
            },
            // Put whatever you need to get passed back above
            actionData: {
                projectId: projectId,
                branchId: branchId,
                branchInfo: branchInfo
            }
        };

        redoLastUndoItem = {
            id: 'redoLastUndo',
            label: 'Redo last undo',
            iconClass: 'fa fa-mail-forward',
            disabled: true, // TODO: set this from handler to enable/disable
            action: function (actionData) {
                self.gmeClient.redo(actionData.branchId, function (/*err*/) {
                });
            },
            // Put whatever you need to get passed back above
            actionData: {
                projectId: projectId,
                branchId: branchId,
                branchInfo: branchInfo
            }
        };

        // create the new branch structure
        self.projects[projectId].branches[branchId] = {
            id: branchId,
            label: branchId,
            properties: {
                commitHash: branchInfo.branchHash,
                commitObject: branchInfo.commitObject || {time: Date.now()}
            },
            isSelected: false,
            itemClass: self.config.branchMenuClass,
            action: selectBranch,
            actionData: {
                projectId: projectId,
                branchId: branchId
            },
            //itemTemplate: 'branch-selector-template',
            menu: [
                {
                    items: [
                        undoLastCommitItem,
                        redoLastUndoItem,
                        {
                            id: 'branchHistory',
                            label: 'Branch history ...',
                            iconClass: 'glyphicon glyphicon-time',
                            action: showBranchHistory,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId,
                                branchInfo: branchInfo
                            }
                        },
                        {
                            id: 'createBranch',
                            label: 'Create branch ...',
                            iconClass: 'glyphicon glyphicon-plus',
                            action: showBranchHistory,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId,
                                branchInfo: branchInfo
                            }
                        },
                        deleteBranchItem,
                        mergeBranchItem,
                        addCommits,
                        {
                            id: 'exportBranch',
                            label: 'Export branch',
                            iconClass: 'glyphicon glyphicon-export',
                            action: exportBranch,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId,
                                commitHash: branchInfo.branchHash
                            }
                        }
                    ]

                }
            ]
        };

        self.projects[projectId].branches[branchId].deleteBranchItem = deleteBranchItem;
        self.projects[projectId].branches[branchId].mergeBranchItem = mergeBranchItem;
        self.projects[projectId].branches[branchId].undoLastCommitItem = undoLastCommitItem;
        self.projects[projectId].branches[branchId].redoLastUndoItem = redoLastUndoItem;
        self.projects[projectId].branches[branchId].applyCommitQueueItem = addCommits;

        for (i = 0; i < self.projects[projectId].menu.length; i += 1) {

            // find the branches id in the menu items
            if (self.projects[projectId].menu[i].id === 'branches') {

                // convert indexed branches to an array
                self.projects[projectId].menu[i].items = self.mapToArray(self.projects[projectId].branches,
                    [{key: 'properties.commitObject.time', reverse: true}, {key: 'id'}]);
                break;
            }
        }

        if (noUpdate === true) {

        } else {
            self.update();
        }
    };

    ProjectNavigatorController.prototype.exportBranch = async function (data) {
        const {projectId, branchId} = data;
        const isActiveBranch = projectId === this.gmeClient.getActiveProjectId() &&
            branchId === this.gmeClient.getActiveBranchName();
        const commitHash = isActiveBranch ? this.gmeClient.getActiveCommitHash() :
            data.commitHash;

        const pluginId = 'ExportBranch';
        const context = this.gmeClient.getCurrentPluginContext(pluginId);
        context.managerConfig.branchName = branchId;
        context.managerConfig.commitHash = commitHash;
        context.pluginConfig = {};
        const result = await Q.ninvoke(this.gmeClient, 'runBrowserPlugin', pluginId, context);

        const [hash] = result.artifacts;
        const bc = new BlobClient({logger: this.logger.fork('BlobClient')});
        const filename = (await bc.getMetadata(hash)).name;
        const url = bc.getDownloadURL(hash);
        return {filename, url};
    };

    return ProjectNavigatorController;
});
