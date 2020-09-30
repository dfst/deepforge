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
            content: []
        };
        this.layout = new GoldenLayout(config, this.$el);
        this.layout.registerComponent(
            'InteractiveEditorComponent',
            InteractiveEditorComponent
        );
        this.layout.init();
        this.session = null;

        this._initialize();
        this._logger.debug('ctor finished');
    }

    InteractiveWorkspaceWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);
    };

    InteractiveWorkspaceWidget.prototype.addEditor = function (editor) {
        const parent = this.layout.root.contentItems.length ?
            this.layout.root.contentItems[0] :
            this.layout.root;

        // TODO: Create a new editor?
        if (!this.session && editor.widget.session) {
            this.session = editor.widget.session.fork();  // TODO: use the control instead
        }

        parent.addChild({
            type: 'component',
            componentName: 'InteractiveEditorComponent',
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
            // TODO: Add the editor itself to the state...
            const {editor} = state;
            // TODO: append the body here?
            container.getElement().append(editor.$el);
        }

        // TODO: when is destroy called?
    }

    return InteractiveWorkspaceWidget;
});
