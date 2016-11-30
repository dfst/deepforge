/*globals define*/
define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'underscore'
], function(
    PanelBaseWithHeader,
    IActivePanel,
    _
) {

    var RenameablePanel = function() {
        PanelBaseWithHeader.apply(this, arguments);
    };

    _.extend(
        RenameablePanel.prototype,
        PanelBaseWithHeader.prototype,
        IActivePanel.prototype
    );

    RenameablePanel.OPTIONS = PanelBaseWithHeader.OPTIONS;
    RenameablePanel.prototype.initializeRenameable = function () {
        this.$panelHeaderTitle.on('click', this.editTitle.bind(this));
    };

    RenameablePanel.prototype.currentNodeId = function () {
        return this.control._currentNodeId;
    };

    RenameablePanel.prototype.currentBaseName = function () {
        var currentId = this.currentNodeId(),
            node = this._client.getNode(currentId),
            baseId = node.getBaseId(),
            base = this._client.getNode(baseId);

        return base.getAttribute('name');
    };

    RenameablePanel.prototype.editTitle = function () {
        this.$panelHeaderTitle.editInPlace({
            css: {
                'z-index': 1000
            },
            onChange: (oldValue, newValue) => {
                var nodeId = this.currentNodeId(),
                    type = this.currentBaseName(),
                    msg = `Renamed ${type}: ${oldValue} -> ${newValue}`;

                if (!/^\s*$/.test(newValue)) {
                    this._client.startTransaction(msg);
                    this._client.setAttribute(nodeId, 'name', newValue);
                    this._client.completeTransaction();
                }
            }
        });
    };

    return RenameablePanel;
});
