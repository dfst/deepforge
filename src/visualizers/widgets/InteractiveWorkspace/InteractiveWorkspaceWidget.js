/*globals define */

define([
    './lib/golden-layout-1.5.9/dist/goldenlayout',
    'css!./lib/golden-layout-1.5.9/src/css/goldenlayout-base.css',
    'css!./lib/golden-layout-1.5.9/src/css/goldenlayout-light-theme.css',
    'css!./styles/InteractiveWorkspaceWidget.css',
], function (
    GoldenLayout,
) {
    'use strict';

    console.log({GoldenLayout});
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

    InteractiveWorkspaceWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    InteractiveWorkspaceWidget.prototype.addNode = function (desc) {
    };

    InteractiveWorkspaceWidget.prototype.removeNode = function (gmeId) {
    };

    InteractiveWorkspaceWidget.prototype.updateNode = function (desc) {
    };

    /* * * * * * * * Visualizer event handlers * * * * * * * */

    InteractiveWorkspaceWidget.prototype.onNodeClick = function (/*id*/) {
        // This currently changes the active node to the given id and
        // this is overridden in the controller.
    };

    InteractiveWorkspaceWidget.prototype.onBackgroundDblClick = function () {
        this.$el.append('<div>Background was double-clicked!!</div>');
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    InteractiveWorkspaceWidget.prototype.destroy = function () {
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
    }

    return InteractiveWorkspaceWidget;
});
