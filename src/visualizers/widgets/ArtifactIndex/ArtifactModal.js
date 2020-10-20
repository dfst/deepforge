/*globals define, $*/
define([
    'deepforge/viz/Utils',
    'text!./ArtifactModal.html'
], function(
    Utils,
    MODAL_HTML
) {
    'use strict';

    const ModalControl = function() {
        this.$el = $(MODAL_HTML);
        this.$modalTitle = this.$el.find('.artifact-name');
        this.$createdAt = this.$el.find('.created-at');
        this.$size = this.$el.find('.size');
        this.$backend = this.$el.find('.backend');
        this.$dataInfo = this.$el.find('.artifact-data-info');
        this.$provBtn = this.$el.find('.reify-prov');
        this.$provBtn.on('click', () => this.onReifyClicked());
    };

    ModalControl.prototype.showModal = function (node) {
        const createdAt = node.createdAt ? Utils.getDisplayTime(node.createdAt) : 'unknown';
        this.$modalTitle.text(node.name || 'undefined');
        this.$size.text(node.size || 'unknown');
        this.$backend.text(node.backendName || 'unknown');
        this.$createdAt.text(createdAt);
        this.$dataInfo.text(`${JSON.stringify(node.dataInfo, null,2)}`);
        this.node = node;
        if (this.node.hasProvenance) {
            this.$provBtn.removeClass('disabled');
        } else {
            this.$provBtn.addClass('disabled');
        }
        this.$el.modal('show');
    };

    ModalControl.prototype.onReifyClicked = function () {
        if (this.node.hasProvenance) {
            this.$el.trigger('ReifyProvenance', this.node.id);
            this.$el.modal('hide');
        }
    };

    return ModalControl;
});
