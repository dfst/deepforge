/*globals define, $, WebGMEGlobal*/
define([
    'js/Controls/PropertyGrid/Widgets/WidgetBase',
    'js/logger'
], function (
    WidgetBase,
    Logger
) {
    'use strict';

    const BTN_ATTACH = $('<a class="btn btn-mini btn-dialog-open"><i class="glyphicon glyphicon-file"/></a>'),
        INPUT_FILE_UPLOAD = $('<input type="file" />'),
        ASSET_WIDGET_BASE = $('<div class="asset-widget" />'),
        ASSET_LINK = $('<a class="local-download-link" href="" target="_blank"></a>');

    class FileWidget extends WidgetBase {
        constructor(propertyDesc) {
            super(propertyDesc);
            if (propertyDesc.readOnly) {
                this._alwaysReadOnly = true;
            }
            this.file = null;

            this.logger = Logger.create('deepforge:viz:widgets:BrowserAssetWidget',
                WebGMEGlobal.gmeConfig.client.log);

            this.parentEl = ASSET_WIDGET_BASE.clone();
            this.el.append(this.parentEl);

            this.assetLink = ASSET_LINK.clone();
            this.parentEl.append(this.assetLink);

            this.fileDropTarget = this.parentEl;

            this.btnAttach = BTN_ATTACH.clone();
            this.parentEl.append(this.btnAttach);

            this.fileUploadInput = INPUT_FILE_UPLOAD.clone();

            this.attachFileDropHandlers();
            this.updateDisplay();
        }

        attachFileDropHandlers() {
            this.btnAttach.on('click', e => {
                e.stopPropagation();
                e.preventDefault();

                this.fileUploadInput.click();
            });

            this.fileUploadInput.on('change', e => {
                e.stopPropagation();
                e.preventDefault();
                this.fileSelectHandler(e.originalEvent);
            });

            this.fileDropTarget.on('dragover',  e => {
                e.stopPropagation();
                e.preventDefault();
            });

            this.fileDropTarget.on('dragenter', e => {
                e.stopPropagation();
                e.preventDefault();
                this.fileDropTarget.addClass('hover');
            });

            this.fileDropTarget.on('dragleave', e => {
                e.stopPropagation();
                e.preventDefault();
                this.fileDropTarget.removeClass('hover');
            });

            this.fileDropTarget.on('drop', e => {
                e.stopPropagation();
                e.preventDefault();
                this.fileDropTarget.removeClass('hover');
                this.fileSelectHandler(e.originalEvent);
            });
        }

        fileSelectHandler(event){
            const files = event.target.files || event.dataTransfer.files;
            if(files){
                this.setFile(files[0]);
            }
        }

        setFile(file) {
            this.file = file;
            this.assetLink.text(this.file.name);
            this.assetLink.attr('href', URL.createObjectURL(this.file));
            this.setValue(file);
        }

        detachFileHandlers(){
            this.fileUploadInput.off('change');
            this.fileDropTarget.off('dragover');
            this.fileDropTarget.off('dragenter');
            this.fileDropTarget.off('dragleave');
            this.fileDropTarget.off('drop');
            this.btnAttach.off('click');
        }

        updateDisplay() {
            if(this.file){
                this.setFile(this.file);
            }
            super.updateDisplay();
        }

        destroy() {
            this.detachFileHandlers();
            super.destroy();
        }
    }

    return FileWidget;
});
