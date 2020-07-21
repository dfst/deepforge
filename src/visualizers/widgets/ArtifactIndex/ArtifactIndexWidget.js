/*globals define, $*/
/*jshint browser: true*/

define([
    './ModelItem',
    './ArtifactModal',
    'panel/FloatingActionButton/styles/Materialize',
    'deepforge/storage/index',
    'deepforge/viz/ConfirmDialog',
    'deepforge/viz/StorageHelpers',
    'text!./Table.html',
    'css!./styles/ArtifactIndexWidget.css'
], function (
    ModelItem,
    ArtifactModal,
    Materialize,
    Storage,
    ConfirmDialog,
    StorageHelpers,
    TABLE_HTML
) {
    'use strict';

    var ArtifactIndexWidget,
        WIDGET_CLASS = 'artifact-index',
        nop = function(){};

    ArtifactIndexWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this.$el = container;

        this.nodes = {};
        this.currentNode = null;
        this._initialize();

        this._logger.debug('ctor finished');
    };

    ArtifactIndexWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        this.$content = $(TABLE_HTML);
        this.$el.append(this.$content);
        this.$list = this.$content.find('.list-content');
        this.artifactModal = new ArtifactModal();
    };

    ArtifactIndexWidget.prototype.onWidgetContainerResize = nop;

    // Adding/Removing/Updating items
    ArtifactIndexWidget.prototype.addNode = function (desc) {
        if (desc && desc.parentId === this.currentNode) {
            var node = new ModelItem(this.$list, desc);
            this.nodes[desc.id] = node;
            node.$delete.on('click', async event => {
                event.stopPropagation();
                event.preventDefault();
                const {dataInfo} = desc;
                const deleteData = await this.askIfDeleteFromStorage(dataInfo);
                const config = deleteData ?
                    await StorageHelpers.getAuthenticationConfig(dataInfo) : null;
                this.onNodeDeleteClicked(desc.id, config);
            });
            node.$download.on('click', async event => {
                event.stopPropagation();
                event.preventDefault();
                try {
                    await StorageHelpers.download(desc.dataInfo, desc.name);
                } catch (err) {
                    const msg = `Unable to fetch ${desc.name}: ${err.message}`;
                    Materialize.toast(msg, 4000);
                }
            });
            node.$el.on('click', event => {
                event.stopPropagation();
                event.preventDefault();
                this.onNodeClick(desc.id);
            });
            node.$name.on('dblclick', event => this.editInPlace(event,{
                nodeId : desc.id,
                targetAttribute : 'name',
                confirmation : null
            }));

            node.$type.on('dblclick', event => this.editInPlace(event, {
                nodeId : desc.id,
                targetAttribute : 'type',
                confirmation : this.confirmArtifactTypeChange.bind(this, node.$name.text()),
            }));

            node.$info.on('click', event => {
                event.stopPropagation();
                this.artifactModal.showModal(desc);
            });
        }
    };

    ArtifactIndexWidget.prototype.askIfDeleteFromStorage = async function (dataInfo) {
        const {backend} = dataInfo;
        const {name} = Storage.getStorageMetadata(backend);
        const title = 'Delete associated data?';
        const body = `Would you also like to delete the associated data from ${name}?`;
        const dialog = new ConfirmDialog(title, body);
        return await dialog.show();
    };

    ArtifactIndexWidget.prototype.confirmArtifactTypeChange = async function(target, newValue, oldValue) {
        const title = `Change data type for <code>${target}</code>?`;
        const body = `Changing the data type from <code>${oldValue}</code> to <code>${newValue}</code> 
            will not change the underlying data and can cause deserialization errors when used in a pipeline. Continue?`;
        const dialog = new ConfirmDialog(title, body);
        return await dialog.show();
    };

    ArtifactIndexWidget.prototype.removeNode = function (gmeId) {
        var node = this.nodes[gmeId];
        if (node) {
            node.remove();
            delete this.nodes[gmeId];
        }
    };

    ArtifactIndexWidget.prototype.updateNode = function (desc) {
        if (desc && desc.parentId === this.currentNode) {
            this.nodes[desc.id].update(desc);
        }
    };

    ArtifactIndexWidget.prototype.editInPlace = function(event, opts) {
        const el = $(event.target);
        const id = opts.nodeId;
        const attr = opts.targetAttribute;

        el.editInPlace({
            css: {
                'z-index' : 1000
            },
            onChange: async (oldVal, newVal) => {
                if (newVal && newVal !== oldVal) {
                    const confirmed = opts.confirmation ? await opts.confirmation.call(
                        this, newVal, oldVal) : true;
                    if(confirmed) {
                        this.onAttributeChange(id, attr, newVal);
                    } else {
                        el.text(oldVal);
                    }
                }
            }
        });
    };

    /* * * * * * * * Visualizer event handlers * * * * * * * */


    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ArtifactIndexWidget.prototype.destroy = function () {
    };

    ArtifactIndexWidget.prototype.onActivate = function () {
    };

    ArtifactIndexWidget.prototype.onDeactivate = function () {
    };

    return ArtifactIndexWidget;
});
