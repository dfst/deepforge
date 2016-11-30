/*globals define, angular, _, $, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Panels/Header/HeaderPanel',
    'panels/BreadcrumbHeader/BreadcrumbHeaderPanel',
    'js/Widgets/UserProfile/UserProfileWidget',
    'js/Widgets/ConnectedUsers/ConnectedUsersWidget',
    'js/Panels/Header/DefaultToolbar',
    './NodePathNavWithHiddenNodes',
    'js/Toolbar/Toolbar',
    './ProjectNavigatorController'
], function (
    HeaderBase,
    BreadcrumbHeader,
    UserProfileWidget,
    ConnectedUsersWidget,
    DefaultToolbar,
    NodePathNavWithHiddenNodes,
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
        HeaderBase.prototype._initialize.call(this);
        var app = angular.module('gmeApp'),
            nodePath = new NodePathNavWithHiddenNodes({
                container: $('<div/>', {class: 'toolbar-container'}),
                client: this._client,
                logger: this.logger
            });

        app.controller('ProjectNavigatorController', ['$scope', 'gmeClient', '$timeout', '$window', '$http',
            ProjectNavigatorController]);

        this.$el.find('.toolbar-container').remove();
        this.$el.append(nodePath.$el);

        WebGMEGlobal.Toolbar = Toolbar.createToolbar($('<div/>'));
        new DefaultToolbar(this._client);
    };

    return HeaderPanel;
});
