/*globals define, angular, _, $, WebGMEGlobal*/
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
        //main container
        var navBar = $('<div/>', {class: 'navbar navbar-inverse navbar-fixed-top'}),
            navBarInner = $('<div/>', {class: 'navbar-inner'}),
            app, projectTitleEl, userProfileEl, connectedUsersEl;

        navBar.append(navBarInner);
        this.$el.append(navBar);

        app = angular.module('gmeApp');

        app.controller('ProjectNavigatorController', ['$scope', 'gmeClient', '$timeout', '$window', '$http',
            ProjectNavigatorController]);

        //project title
        projectTitleEl = $(
            '<div style="display: inline;" data-ng-controller="ProjectNavigatorController">' +
            '<dropdown-navigator style="display: inline-block;" navigator="navigator"></dropdown-navigator></div>',
            {class: 'inline'}
        );
        //new ProjectTitleWidget(projectTitleEl, this._client);
        navBarInner.append(projectTitleEl);
        navBarInner.append($('<div class="spacer pull-right"></div>'));

        //user info
        if (this._config.disableUserProfile === false && WebGMEGlobal.gmeConfig.authentication.enable === true) {
            userProfileEl = $('<div/>', {class: 'inline pull-right', style: 'padding: 6px 0px;'});
            this.defaultUserProfileWidget = new UserProfileWidget(userProfileEl, this._client);
            navBarInner.append(userProfileEl);
        }

        //connected users
        connectedUsersEl = $('<div/>', {class: 'inline pull-right', style: 'padding: 6px 0px;'});
        this.connectedUsersWidget = new ConnectedUsersWidget(connectedUsersEl, this._client);
        navBarInner.append(connectedUsersEl);

        //toolbar
        var nodePath = new NodePathNavigator({
            container: $('<div/>', {class: 'toolbar-container'}),
            client: this._client,
            logger: this.logger
        });
        this.$el.append(nodePath.$el);
        WebGMEGlobal.Toolbar = Toolbar.createToolbar($('<div/>'));
        new DefaultToolbar(this._client);
    };

    return HeaderPanel;
});
