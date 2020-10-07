/*globals define, WebGMEGlobal*/

define([
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'deepforge/globals',
    'text!./InteractiveEditors.json',
], function (
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames,
    DeepForge,
    InteractiveEditors,
) {

    'use strict';

    InteractiveEditors = JSON.parse(InteractiveEditors);
    class InteractiveWorkspaceControl{
        constructor(options) {

            this._logger = options.logger.fork('Control');

            this._client = options.client;

            // Initialize core collections and variables
            this._widget = options.widget;

            this._currentNodeId = null;
            this._currentNodeParentId = undefined;

            this.editors = [];
            this._initWidgetEventHandlers();
            this._logger.debug('ctor finished');
        }

        _initWidgetEventHandlers() {
            this.getAvailableEditors().forEach(info => {
                DeepForge.registerAction(
                    `Open ${info.title}`,
                    'add',
                    10,
                    () => this.openEditor(info)
                );
            });
        }

        getAvailableEditors() {
            const libraries = this._client.getLibraryNames();
            return InteractiveEditors.filter(editorInfo => {
                const deps = editorInfo.dependencies || [];
                const isSupported = deps.every(dep => libraries.includes(dep));
                return isSupported;
            });
        }

        async openEditor(editorInfo) {
            const EditorPanel = await this.require(editorInfo.panel);
            if (!this.session) {
                const connectedEditor = this.editors
                    .find(editor => editor.control.session);
                this.session = connectedEditor && connectedEditor.control.session;
            }

            const editor = new EditorPanel(null, {
                client: this._client,
                embedded: this._embedded,
                session: this.session && this.session.fork(),
            });

            editor.control.on('computeInitialized', session => {
                this.session = session;
                this.editors.forEach(editor => {
                    const hasSession = !!editor.control.session;
                    if (!hasSession) {
                        editor.control.onComputeInitialized(session.fork());
                    }
                });
            });
            editor.control.on('destroy', () => {
                const index = this.editors.indexOf(editor);
                if (index > -1) {
                    this.editors.splice(index, 1);
                }
            });

            if (editor.control && editor.control.selectedObjectChanged) {
                const nodeId = await DeepForge.places.MyArtifacts();
                editor.control.selectedObjectChanged(nodeId);
            }
            this.editors.push(editor);
            this._widget.addEditor(editorInfo.title, editor);
        }

        require(path) {
            return new Promise((resolve, reject) => require([path], resolve, reject));
        }

        /* * * * * * * * Visualizer content update callbacks * * * * * * * */
        selectedObjectChanged(nodeId) {
            this._currentNodeId = nodeId;
        }

        _stateActiveObjectChanged(model, activeObjectId) {
            if (this._currentNodeId === activeObjectId) {
                // The same node selected as before - do not trigger
            } else {
                this.selectedObjectChanged(activeObjectId);
            }
        }

        /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
        destroy() {
            this.getAvailableEditors().forEach(info => {
                DeepForge.unregisterAction(`Open ${info.title}`);
            });
            this._detachClientEventListeners();
            if (this.session) {
                this.session.close();
            }
        }

        _attachClientEventListeners() {
            this._detachClientEventListeners();
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }

        _detachClientEventListeners() {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }

        onActivate() {
            if (!this._embedded) {
                this._attachClientEventListeners();

                if (typeof this._currentNodeId === 'string') {
                    WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
                }
            }
        }

        onDeactivate() {
            if (!this._embedded) {
                this._detachClientEventListeners();
            }
        }
    }

    return InteractiveWorkspaceControl;
});
