/*globals define, $ */

define([
    './lib/golden-layout-1.5.9/dist/goldenlayout',
    'css!./lib/golden-layout-1.5.9/src/css/goldenlayout-base.css',
    'css!./lib/golden-layout-1.5.9/src/css/goldenlayout-light-theme.css',
    'css!./styles/InteractiveWorkspaceWidget.css',
], function (
    GoldenLayout,
) {
    'use strict';

    var WIDGET_CLASS = 'interactive-workspace';

    function InteractiveWorkspaceWidget(logger, container) {
        this._logger = logger.fork('Widget');
        this.$el = container;
        const config = {
            settings: {
                showPopoutIcon: false,
            },
            content: []
        };
        this.layout = new GoldenLayout(config, this.$el);
        this.layout.registerComponent(
            'Welcome',
            WelcomeComponent
        );
        this.layout.on('itemDestroyed', component => {
            if (component.instance instanceof InteractiveEditorComponent) {
                component.instance.destroy();
            }
        });
        this.layout.init();

        this._initialize();
        this._registeredComponentTypes = [];
        this._logger.debug('ctor finished');
    }

    InteractiveWorkspaceWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        setTimeout(() => {
            this.layout.root.addChild({
                type: 'component',
                componentName: 'Welcome',
            });
        });
    };

    InteractiveWorkspaceWidget.prototype.addEditor = function (title, editor) {
        const parent = this.layout.root.contentItems.length ?
            this.layout.root.contentItems[0] :
            this.layout.root;

        if (!this._registeredComponentTypes.includes(title)) {
            this.layout.registerComponent(
                title,
                InteractiveEditorComponent
            );
            this._registeredComponentTypes.push(title);
        }

        parent.addChild({
            type: 'component',
            componentName: title,
            componentState: {
                editor: editor,
            },
        });
    };

    InteractiveWorkspaceWidget.prototype.onWidgetContainerResize = function (/*width, height*/) {
        this._logger.debug('Widget is resizing...');
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    InteractiveWorkspaceWidget.prototype.destroy = function () {
        console.log('destroy');
    };

    InteractiveWorkspaceWidget.prototype.onActivate = function () {
        this._logger.debug('InteractiveWorkspaceWidget has been activated');
    };

    InteractiveWorkspaceWidget.prototype.onDeactivate = function () {
        this._logger.debug('InteractiveWorkspaceWidget has been deactivated');
    };

    class InteractiveEditorComponent {
        constructor(container, state) {
            const {editor} = state;
            container.getElement().append(editor.$el);
            this.editor = editor;
        }

        destroy() {
            this.editor.destroy();
        }

        onResize() {
            this.editor.onResize(this.editor.$el.width(), this.editor.$el.height());
        }
    }

    class WelcomeComponent {
        constructor(container/*, state*/) {

            const element = $('<div>', {class: 'welcome'});
            element.text('No editors open...');
            container.getElement().append(element);
        }

        destroy() {
        }
    }

    return InteractiveWorkspaceWidget;
});
