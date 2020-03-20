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
        this.$modal = $(MODAL_HTML);
        this.$modalTitle = this.$modal.find('.artifact-name');
        this.$createdAt = this.$modal.find('.created-at');
        this.$size = this.$modal.find('.size');
        this.$backend = this.$modal.find('.backend');
        this.$dataInfo = this.$modal.find('.artifact-data-info');
    };

    ModalControl.prototype.showModal = function (node) {
        const createdAt = node.createdAt ? Utils.getDisplayTime(node.createdAt) : 'unknown';
        this.$modalTitle.text(node.name || 'undefined');
        this.$size.text(node.size || 'unknown');
        this.$backend.text(node.backendName || 'unknown');
        this.$createdAt.text(createdAt);
        this.$dataInfo.text(`${JSON.stringify(node.dataInfo, null,2)}`);
        this.$modal.modal({show: true});
    };

    return ModalControl;
});
