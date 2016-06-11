/*globals define, _, WebGMEGlobal, $ */
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 */

define([
    'js/PanelBase/PanelBase',
    'js/Widgets/NetworkStatus/NetworkStatusWidget',
    'js/Widgets/BranchStatus/BranchStatusWidget',
    'js/Widgets/BranchSelector/BranchSelectorWidget',
    'js/Widgets/KeyboardManager/KeyboardManagerWidget',
    'js/Widgets/Notification/NotificationWidget'
], function (PanelBase,
             NetworkStatusWidget,
             BranchStatusWidget,
             BranchSelectorWidget,
             KeyboardManagerWidget,
             NotificationWidget) {

    'use strict';

    var FooterPanel,
        __parent__ = PanelBase;

    FooterPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBase.OPTIONS.LOGGER_INSTANCE_NAME] = 'FooterPanel';

        //call parent's constructor
        __parent__.apply(this, [options]);

        this._client = params.client;

        //initialize UI
        this._initialize();

        this.logger.debug('FooterPanel ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(FooterPanel.prototype, __parent__.prototype);

    FooterPanel.prototype._initialize = function () {
        //main container
        var navBar = $('<div/>', {class: 'navbar navbar-inverse navbar-fixed-bottom'}),
            navBarInner = $('<div/>', {class: 'navbar-inner'}),
            separator = $('<div class="spacer pull-right"></div>'),
            widgetPlaceHolder = $('<div class="pull-right"></div>'),
            keyBoardManagerEl,
            networkStatusEl,
            branchStatusEl,
            notificationEl;

        navBar.append(navBarInner);
        this.$el.append(navBar);

        //padding from screen right edge
        navBarInner.append(separator.clone());

        //keyboard enable/disbale widget (NOTE: only on non touch device)
        if (WebGMEGlobal.SUPPORTS_TOUCH !== true) {
            keyBoardManagerEl = widgetPlaceHolder.clone();
            new KeyboardManagerWidget(keyBoardManagerEl);
            navBarInner.append(keyBoardManagerEl).append(separator.clone());
        }

        networkStatusEl = widgetPlaceHolder.clone();
        new NetworkStatusWidget(networkStatusEl, this._client);
        navBarInner.append(networkStatusEl).append(separator.clone());

        notificationEl = widgetPlaceHolder.clone();
        new NotificationWidget(notificationEl, this._client);
        navBarInner.append(notificationEl).append(separator.clone());

        branchStatusEl = widgetPlaceHolder.clone();
        new BranchStatusWidget(branchStatusEl, this._client);
        navBarInner.append(branchStatusEl).append(separator.clone());
    };

    return FooterPanel;
});
