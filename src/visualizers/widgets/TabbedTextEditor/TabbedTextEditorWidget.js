/*globals define, $*/

define([
    'css!./styles/TabbedTextEditorWidget.css'
], function (
) {
    'use strict';

    var TabbedTextEditorWidget,
        WIDGET_CLASS = 'tabbed-text-editor';

    TabbedTextEditorWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this.$el = container;

        this.tabs = [];
        this._initialize();

        this._logger.debug('ctor finished');
    };

    TabbedTextEditorWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        // Create a dummy header
        const tabContainer = $('<div>', {class: 'tab'});
        this.$tabs = $('<div>', {class: 'node-tabs'});
        tabContainer.append(this.$tabs);
        this.addNewFileBtn(tabContainer);

        this.$el.append(tabContainer);
        this.$el.append(`<div class="current-tab-content"></div>`);
    };

    TabbedTextEditorWidget.prototype.addNewFileBtn = function (cntr) {
        this.$newTab = $('<button>', {class: 'tablinks'});
        this.$newTab.append(`<span class="oi oi-plus" title="Create new file..." aria-hidden="true"></span>`);
        this.$newTab.click(() => this.onAddNewClicked());
        cntr.append(this.$newTab);
    };

    TabbedTextEditorWidget.prototype.onAddNewClicked = function () {
        // Ensure unique?
        // TODO
        const name = 'Test.py';
        // Prompt the user for the name of the new code file
        // TODO
        return this.addNewFile(name);
    };

    TabbedTextEditorWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    TabbedTextEditorWidget.prototype.addNode = function (desc) {
        if (desc) {
            // Add node to a table of tabs
            const tab = document.createElement('button');
            tab.className = 'tablinks';
            tab.setAttribute('data-id', desc.id);

            const name = document.createElement('span');
            name.innerHTML = desc.name;

            tab.appendChild(name);
            const rmBtn = document.createElement('span');
            rmBtn.className = 'oi oi-circle-x remove-file';
            rmBtn.setAttribute('title', 'Delete file');
            rmBtn.onclick = () => this.onDeleteNode(desc.id);
            tab.appendChild(rmBtn);

            this.$tabs.append(tab);
            tab.onclick = () => this.setActiveTab(desc.id);
            this.tabs.push({
                id: desc.id,
                $el: tab,
                $name: name
            });
        }
    };

    TabbedTextEditorWidget.prototype.getTab = function (id) {
        return this.tabs.find(tab => tab.id === id);
    };

    TabbedTextEditorWidget.prototype.setActiveTab = function (id) {
        const tab = this.getTab(id);
        const formerActive = Array.prototype.slice
            .call(document.getElementsByClassName('tablinks active'));

        formerActive.forEach(tab => tab.className = tab.className.replace(' active', ''));
        tab.$el.className += ' active';

        this.onTabSelected(id);
    };

    TabbedTextEditorWidget.prototype.isActiveNode = function (gmeId) {
        const tab = this.getTab(gmeId);
        return tab && tab.$el.className.includes('active');
    };

    TabbedTextEditorWidget.prototype.removeNode = function (gmeId) {
        const tab = this.getTab(gmeId);
        const needsActiveUpdate = this.isActiveNode(gmeId);

        tab.$el.remove();

        const index = this.tabs.indexOf(tab);
        this.tabs.splice(index, 1);

        if (needsActiveUpdate) {
            if (this.tabs.length) {
                const newIndex = Math.min(this.tabs.length-1, index);
                const activeId = this.tabs[newIndex].id;
                this.setActiveTab(activeId);
            } else {
                console.log('show no files message');
            }
        }
    };

    TabbedTextEditorWidget.prototype.updateNode = function (desc) {
        const tab = this.getTab(desc.id);
        if (tab) {
            tab.$name.innerHTML = desc.name;
            this._logger.debug('Updating node:', desc);
        }
    };

    /* * * * * * * * Visualizer event handlers * * * * * * * */

    TabbedTextEditorWidget.prototype.onNodeClick = function (/*id*/) {
        // This currently changes the active node to the given id and
        // this is overridden in the controller.
    };

    TabbedTextEditorWidget.prototype.onBackgroundDblClick = function () {
        this.$el.append('<div>Background was double-clicked!!</div>');
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TabbedTextEditorWidget.prototype.destroy = function () {
    };

    TabbedTextEditorWidget.prototype.onActivate = function () {
        this._logger.debug('TabbedTextEditorWidget has been activated');
    };

    TabbedTextEditorWidget.prototype.onDeactivate = function () {
        this._logger.debug('TabbedTextEditorWidget has been deactivated');
    };

    return TabbedTextEditorWidget;
});
