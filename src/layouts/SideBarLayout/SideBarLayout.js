/*globals define, */
define([
    'layout/CHFLayout/CHFLayout/CHFLayout',
    'text!./templates/SideBarLayout.html',
    'css!./SideBarLayout.css'
], function(
    CHFLayout,
    SidebarTemplate
) {
    'use strict';
    
    var SideBarLayout = function(params) {
        params = params || {};
        params.template = SidebarTemplate;
        CHFLayout.call(this, params);
    };

    SideBarLayout.prototype = Object.create(CHFLayout.prototype);

    SideBarLayout.prototype.getComponentId = function () {
        return 'SideBarLayout';
    };

    /**
     * Initialize the html page. This example is using the jQuery Layout plugin.
     *
     * @return {undefined}
     */
    SideBarLayout.prototype.init = function() {
        CHFLayout.prototype.init.apply(this, arguments);
        this._sidebarPanel = this._body.find('div.ui-layout-sidebar');
    };

    /**
     * Add a panel to a given container. This is defined in the corresponding
     * layout config JSON file.
     *
     * @param {Panel} panel
     * @param {String} container
     * @return {undefined}
     */
    SideBarLayout.prototype.addToContainer = function(panel, container) {
        if (container === 'sidebar') {
            this._sidebarPanel.append(panel.$pEl);
        } else {
            CHFLayout.prototype.addToContainer.apply(this, arguments);
        }
    };

    return SideBarLayout;
});
