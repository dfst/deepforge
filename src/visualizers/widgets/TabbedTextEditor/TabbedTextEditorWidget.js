/*globals define, $*/

define([
    'deepforge/viz/TextPrompter',
    'underscore',
    'css!./styles/TabbedTextEditorWidget.css'
], function (
    TextPrompter,
    _
) {
    'use strict';

    var TabbedTextEditorWidget,
        WIDGET_CLASS = 'tabbed-text-editor';

    const DEFAULT_CONFIG = {
        message: {
            new: 'New Module Name (eg. module.py)',
            empty: 'No Existing Python Modules...',
            rename: 'Change Module Name (eg. module.py)',
        },
        canCreateTabs: true
    };

    TabbedTextEditorWidget = function (logger, container, config) {
        this._logger = logger.fork('Widget');

        this.$el = container;

        this.tabs = [];
        config = config || {};
        this.config = _.extend({}, DEFAULT_CONFIG, config);
        this.config.message = _.extend({}, DEFAULT_CONFIG.message, config.message);
        this._initialize(this.config);
        this.activeTabId = null;

        this._logger.debug('ctor finished');
    };

    TabbedTextEditorWidget.prototype._initialize = function (config) {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        // Create a dummy header
        const tabContainer = $('<div>', {class: 'tab'});
        this.$tabs = $('<div>', {class: 'node-tabs'});
        tabContainer.append(this.$tabs);
        if (config.canCreateTabs) {
            this.addNewFileBtn(tabContainer, config);
        }

        this.$el.append(tabContainer);
        this.$el.append(`
        <div class="content">
            <div class="empty-message">"${config.message.empty}"</div>
            <div class="current-tab-content"></div>
        </div>`);
        this.$tabContent = this.$el.find('.current-tab-content');
    };

    TabbedTextEditorWidget.prototype.addNewFileBtn = function (cntr, config) {
        this.$newTab = $('<button>', {class: 'tablinks'});
        this.$newTab.append('<span class="oi oi-plus" title="Create new file..." aria-hidden="true"></span>');
        this.$newTab.click(() => this.onAddNewClicked(config.message.new));
        cntr.append(this.$newTab);
    };

    TabbedTextEditorWidget.prototype.onAddNewClicked = function (message) {
        // Prompt the user for the name of the new code file
        return TextPrompter.prompt(message)
            .then(name => this.addNewFile(name));
    };

    TabbedTextEditorWidget.prototype.onWidgetContainerResize = function (/*width, height*/) {
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    TabbedTextEditorWidget.prototype.renameTab = function (id) {
        return TextPrompter.prompt(this.config.message.rename)
            .then(name => this.setTabName(id, name));
    };

    TabbedTextEditorWidget.prototype.addTab = function (desc) {
        const {supportedActions={}} = desc;

        if (desc) {
            // Add node to a table of tabs
            const tab = document.createElement('button');
            tab.className = 'tablinks';
            tab.setAttribute('data-id', desc.id);

            const name = document.createElement('span');
            name.innerHTML = desc.name;
            if (supportedActions.rename !== false) {
                name.ondblclick = event => {
                    this.renameTab(desc.id);
                    event.stopPropagation();
                };
            }

            tab.appendChild(name);
            if (supportedActions.delete !== false) {
                const rmBtn = document.createElement('span');
                rmBtn.className = 'oi oi-circle-x remove-file';
                rmBtn.setAttribute('title', 'Delete file');
                rmBtn.onclick = () => this.onDeleteTab(desc.id);
                tab.appendChild(rmBtn);
            }

            this.$tabs.append(tab);
            tab.onclick = () => this.setActiveTab(desc.id);
            this.tabs.push({
                id: desc.id,
                $el: tab,
                $name: name
            });

            if (!this.activeTabId) {
                this.setActiveTab(desc.id);
            }
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

        this.activeTabId = id;
        // Make the code editor show up (display: block)
        this.$tabContent.css('display', 'block');
        this.onTabSelected(id);
    };

    TabbedTextEditorWidget.prototype.isActiveTab = function (tabId) {
        const tab = this.getTab(tabId);
        return tab && tab.$el.className.includes('active');
    };

    TabbedTextEditorWidget.prototype.removeTab = function (tabId) {
        const tab = this.getTab(tabId);
        const needsActiveUpdate = this.isActiveTab(tabId);

        tab.$el.remove();

        const index = this.tabs.indexOf(tab);
        this.tabs.splice(index, 1);

        if (needsActiveUpdate) {
            if (this.tabs.length) {
                const newIndex = Math.min(this.tabs.length-1, index);
                const activeId = this.tabs[newIndex].id;
                this.setActiveTab(activeId);
            } else {
                this.$tabContent.css('display', 'none');
                this.activeTabId = null;
            }
        }
    };

    TabbedTextEditorWidget.prototype.updateTab = function (desc) {
        const tab = this.getTab(desc.id);
        if (tab) {
            tab.$name.innerHTML = desc.name;
            this._logger.debug('Updating node:', desc);
        }
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
