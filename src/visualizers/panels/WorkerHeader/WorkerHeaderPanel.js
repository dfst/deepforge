/*globals define, angular, _,*/
/*jshint browser: true*/

define([
    'panels/BreadcrumbHeader/BreadcrumbHeaderPanel',
    'js/Widgets/UserProfile/UserProfileWidget',
    'js/Widgets/ConnectedUsers/ConnectedUsersWidget',
    'js/Panels/Header/DefaultToolbar',
    'panels/BreadcrumbHeader/NodePathNavigator',
    'js/Toolbar/Toolbar',
    './ProjectNavigatorController'
], function (
    BreadcrumbHeader,
    UserProfileWidget,
    ConnectedUsersWidget,
    DefaultToolbar,
    NodePathNavigator,
    Toolbar,
    ProjectNavigatorController
) {
    'use strict';

    var HeaderPanel;

    HeaderPanel = function (layoutManager, params) {
        BreadcrumbHeader.call(this, layoutManager, params);
    };

    //inherit from PanelBaseWithHeader
    _.extend(HeaderPanel.prototype, BreadcrumbHeader.prototype);

    HeaderPanel.prototype._initialize = function () {
        BreadcrumbHeader.prototype._initialize.call(this);
        var app = angular.module('gmeApp');

        app.controller('ProjectNavigatorController', ['$scope', 'gmeClient', '$timeout', '$window', '$http',
            ProjectNavigatorController]);
    };

    return HeaderPanel;
});
