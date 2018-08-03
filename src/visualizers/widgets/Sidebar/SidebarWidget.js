/*globals $, define */
/*jshint browser: true*/

define([
    'panel/FloatingActionButton/styles/Materialize',
    'deepforge/globals',
    'text!./NavBar.html',
    'css!./styles/SidebarWidget.css',
    'css!./lib/font/css/open-iconic-bootstrap.min.css'
], function (
    Materialize,
    DeepForge,
    NavBarHTML
) {
    'use strict';

    var SidebarWidget,
        WIDGET_CLASS = 'main-view',
        CATEGORIES = [
            'pipelines',
            'executions',
            'resources',
            'artifacts',
            'code',
            'utils'
        ];

    SidebarWidget = function (logger, container) {
        this.logger = logger.fork('Widget');
        this.$el = container;
        this.$el.addClass(WIDGET_CLASS);
        this.initialize();
        this.logger.debug('ctor finished');
        this._currentSelection = '$pipelinesIcon';
    };

    SidebarWidget.prototype.initialize = function () {
        // Create the nav bar
        this.$nav = $(NavBarHTML);
        this.$el.append(this.$nav);

        // Execution support
        CATEGORIES.forEach(category => {
            var varName = `$${category}Icon`;
            this[varName] = this.$nav.find(`.${category}-icon`);
            this[varName].on('click', () => {
                this.setEmbeddedPanel(category);
                this.highlight(category);
            });
        });

        this.htmlFor = {};
    };

    SidebarWidget.prototype.highlight = function (category) {
        var varName = `$${category}Icon`;
        // Remove the 'active' class from the current
        this[this._currentSelection].removeClass('active');
        this[varName].addClass('active');
        this._currentSelection = varName;
    };

    SidebarWidget.prototype.checkLibraries = function () {

        if (!this.getProjectName()) {
            return;
        }

        return this.checkUpdates()
            .then(updates => {
                if (updates.length) {  // prompt about updates
                    const msg = `${updates.length} update(s) available. Click to update.`;
                    var names = updates.map(update => update.name),
                        projName = this.getProjectName(),
                        content = $('<span>');

                    this.logger.info(`Updates available for ${projName}: ${names.join(', ')}`);

                    content.text(msg);
                    content.on('click', () => {
                        // Remove the toast
                        content.parent().fadeOut();

                        // Create updating notification
                        content.text('Applying Updates...');
                        Materialize.toast(content, 8000);
                        this.applyUpdates(updates).then(() => {
                            content.parent().remove();
                            Materialize.toast('Update complete!', 2000);
                        });
                    });

                    Materialize.toast(content, 8000);
                }
            })
            .catch(err => Materialize.toast(`Update check failed: ${err}`, 2000));
    };

    SidebarWidget.prototype.width = function () {
        return this._closedWidth;
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    SidebarWidget.prototype.destroy = function () {
    };

    SidebarWidget.prototype.onActivate = function () {
        this.logger.debug('SidebarWidget has been activated');
    };

    SidebarWidget.prototype.onDeactivate = function () {
        this.logger.debug('SidebarWidget has been deactivated');
    };

    return SidebarWidget;
});
