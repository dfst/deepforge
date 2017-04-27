/*globals define, */
define([
    'layout/CHFLayout/CHFLayout/CHFLayout',
    'text!./templates/SidebarLayout.html',
    'css!./SidebarLayout.css'
], function(
    CHFLayout,
    SidebarTemplate
) {
    'use strict';
    
    var SidebarLayout = function(params) {
        params = params || {};
        params.template = SidebarTemplate;
        CHFLayout.call(this, params);
    };

    SidebarLayout.prototype = Object.create(CHFLayout.prototype);

    SidebarLayout.prototype.getComponentId = function () {
        return 'SidebarLayout';
    };

    /**
     * Initialize the html page. This example is using the jQuery Layout plugin.
     *
     * @return {undefined}
     */
    SidebarLayout.prototype.init = function() {
        CHFLayout.prototype.init.apply(this, arguments);
        this._sidebarPanel = this._body.find('div.ui-layout-sidebar');
        this._centerPanel = this._body.find('div.layout-center');
    };

    /**
     * Add a panel to a given container. This is defined in the corresponding
     * layout config JSON file.
     *
     * @param {Panel} panel
     * @param {String} container
     * @return {undefined}
     */
    SidebarLayout.prototype.addToContainer = function(panel, container) {
        if (container === 'sidebar') {
            this._sidebarPanel.append(panel.$pEl);
        } else {
            CHFLayout.prototype.addToContainer.apply(this, arguments);
        }
    };

    SidebarLayout.prototype._onCenterResize = function() {
        var width = this._centerPanel.width() - this._sidebarPanel.width();
        this._canvas.setSize(width, this._centerPanel.height());
    };

    return SidebarLayout;
});
