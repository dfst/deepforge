/* globals define, $*/
define([
], function(
) {

    const ConfirmDialog = function(title, body) {
        this.$el = this.createElement(title, body);
        this.$ok = this.$el.find('.btn-primary');
        this.$cancel = this.$el.find('.btn-secondary');
    };

    ConfirmDialog.prototype.createElement = function(title, body) {
        const html = `<div class="modal" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
              </div>
              <div class="modal-body">
                <p>${body}</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-save btn-primary" data-dismiss="modal">Yes</button>
                <button type="button" class="btn btn-default btn-secondary" data-dismiss="modal">No</button>
              </div>
            </div>
          </div>
        </div>`;
        return $(html);
    };

    ConfirmDialog.prototype.show = function() {
        return new Promise(resolve => {
            this.$ok.on('click', () => resolve(true));
            this.$cancel.on('click', () => resolve(false));
            this.$el.modal('show');
            this.$el.on('hidden.bs.modal', () => resolve(false));
        });
    };

    return ConfirmDialog;
});
