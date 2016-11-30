/* globals define, WebGMEGlobal */
define([
    'js/Dialogs/Projects/ProjectsDialog',
    './WorkerDialog',
    'js/Panels/Header/ProjectNavigatorController'
], function(
    ProjectsDialog,
    WorkerDialog,
    GMEProjectNavigatorController
) {
    'use strict';
    var ProjectNavigatorController = function() {
        GMEProjectNavigatorController.apply(this, arguments);
    };

    ProjectNavigatorController.prototype = Object.create(GMEProjectNavigatorController.prototype);

    ProjectNavigatorController.prototype.initialize = function () {
        var self = this,
            newProject,
            manageProjects,
            manageWorkers;


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

        manageWorkers = function() {
            // Create the worker dialog
            var pd = new WorkerDialog(self.logger);
            pd.show();
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
                            id: 'manageWorkers',
                            label: 'View workers ...',
                            iconClass: 'glyphicon glyphicon-cloud',
                            action: manageWorkers
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

    return ProjectNavigatorController;
});
