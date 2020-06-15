/* globals define, $ */

define([], function () {
    const DEFAULT_MODAL_BACKGROUND = '#1e1e1e';

    const SELECTOR_HTML = $('<select class="form-control"/>');

    class DisplayMenu {
        constructor(props = {}) {
            this.fontSizes = props.fontSizes || [8, 10, 11, 12, 14];
            this.themes = props.themes || ['vs', 'vs-dark'];
            this.keyBindings = props.keyBindings || ['default', 'emacs', 'vim'];
            this.activeSelections = props.defaults || {
                fontSize: 12,
                theme: 'vs-dark',
                keyBindings: 'default'
            };
            this.$el = this.createModalElement();
            this.$body = this.$el.find('.modal-body');
            this.$footer = this.$el.find('.modal-footer');
        }

        createModalElement() {
            const ModalHTML = `<div class="modal" tabindex="-1" role="dialog">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Editor Display Settings</h5>
                        </div>
                        <div class="modal-body">
                            <div class="container">
                                <div class="row">
                                    <div class="col-md-6">
                                    Font Sizes:
                                    </div>
                                    <div class="col-md-6 font-size-parent">
                                        
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-save btn-primary" data-dismiss="modal">Confirm</button>
                            <button type="button" class="btn btn-default btn-secondary" data-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>`;
            return $(ModalHTML);
        }

        addDefaultSelections() {
            const $fontSizeSelector = $(SELECTOR_HTML).clone();
            const $parent = this.$body.find('.font-size-selector');
            this.fontSizes.forEach(fontSize => {
                const isActive = fontSize === this.activeSelections.fontSize;
                $fontSizeSelector.append($('<option/>',
                    {
                        value: fontSize,
                        text:  fontSize,
                        attr: isActive ? 'selected': ''
                    })
                );
            });
            $parent.append($fontSizeSelector);
        }

        show() {
            this.addDefaultSelections();
            this.$el.modal('show');
        }


    }

    return DisplayMenu;

});
