/*globals define, WebGMEGlobal, $*/
/*jshint browser: true*/

define([
    'deepforge/viz/Utils',
    'widgets/LineGraph/LineGraphWidget',
    'text!./ExecTable.html',
    'css!./styles/ExecutionIndexWidget.css'
], function (
    Utils,
    LineGraphWidget,
    TableHtml
) {
    'use strict';

    var ExecutionIndexWidget,
        WIDGET_CLASS = 'execution-index';

    ExecutionIndexWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this.$el = container;

        this.nodes = {};
        this.graphs = {};
        this.checkedIds = [];
        this._initialize();

        this._logger.debug('ctor finished');
    };

    ExecutionIndexWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        // Create split screen
        this.$left = $('<div>', {class: 'left'});
        this.$right = $('<div>', {class: 'right'});
        this.$el.append(this.$left, this.$right);

        // Create the table
        this.$table = $(TableHtml);
        this.$table.on('click', '.exec-row', event => this.onExecutionClicked(event));
        this.$table.on('click', '.node-nav', event => this.navToNode(event));
        this.$left.append(this.$table);
        this.$execList = this.$table.find('.execs-content');

        // Create the graph in the right half
        this.lineGraph = new LineGraphWidget(this._logger, this.$right);
        this.defaultSelection = null;
        this.hasRunning = false;
    };

    ExecutionIndexWidget.prototype.navToNode = function (event) {
        var id = event.target.getAttribute('data-id');
        if (typeof id === 'string') {
            WebGMEGlobal.State.registerActiveObject(id);
            event.stopPropagation();
        }
        this._logger.warn('No node id found for node-nav!');
    };

    ExecutionIndexWidget.prototype.onExecutionClicked = function (event) {
        var target = event.target,
            checked,
            id;

        while (!target.getAttribute('data-id')) {
            if (!target.parentNode) {
                this._logger.error('could not find execution id for ' + event);
                return;
            }
            target = target.parentNode;
        }
        id = target.getAttribute('data-id');

        checked = this.nodes[id].$checkbox.checked;
        if (event.target.tagName.toLowerCase() !== 'input') {
            this.setSelect(id, !checked);
        } else {
            this.setExecutionDisplayed(id, checked);
        }
    };

    ExecutionIndexWidget.prototype.onWidgetContainerResize = function (width, height) {
        this.$left.css({
            width: width/2,
            height: height
        });
        this.$right.css({
            left: width/2,
            width: width/2,
            height: height
        });
        this.lineGraph.onWidgetContainerResize(width/2, height);
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    ExecutionIndexWidget.prototype.addNode = function (desc) {
        var isFirstNode = Object.keys(this.nodes).length === 0;

        if (desc.type === 'Execution') {
            // Add node to a table of nodes
            this.addExecLine(desc);
            this.updateSelected(desc);
        } else if (desc.type === 'line') {
            desc.type = 'line';
            this.lineGraph.addNode(desc);
        }

        if (isFirstNode) {
            this.updateTimes();
        }
    };

    ExecutionIndexWidget.prototype.updatePipelineName = function (execId, name) {
        if (this.nodes[execId]) {
            this.nodes[execId].$pipeline.text(name);
        }
    };

    ExecutionIndexWidget.prototype.addExecLine = function (desc) {
        var row = $('<tr>', {class: 'exec-row', 'data-id': desc.id}),
            checkBox = $('<input>', {type: 'checkbox'}),
            statusClass = Utils.ClassForJobStatus[desc.status],
            fields,
            pipeline,
            name,
            duration = $('<div>'),
            td;

        pipeline = $('<a>', {
            class: 'node-nav',
            'data-id': desc.originId
        }).text(desc.pipelineName || 'view pipeline');

        name = $('<a>', {class: 'node-nav', 'data-id': desc.id})
            .text(desc.name);

        fields = [
            checkBox,
            name,
            Utils.getDisplayTime(desc.originTime),
            pipeline,
            duration
        ];

        for (var i = 0; i < fields.length; i++) {
            td = $('<td>');
            if ((typeof fields[i]) === 'string') {
                td.text(fields[i]);
            } else {
                td.append(fields[i]);
            }
            row.append(td);
        }

        this._logger.debug(`Adding execution ${desc.name} (${desc.id}) to list`);
        this.$execList.append(row);
        row.addClass(statusClass);

        this.nodes[desc.id] = {
            statusClass: statusClass,
            desc: desc,
            $el: row,
            $checkbox: checkBox[0],
            $pipeline: pipeline,
            $duration: duration,
            $name: name
        };
        this.updateTime(desc.id, true);
    };

    ExecutionIndexWidget.prototype.getDurationText = function (duration) {
        var hours,
            min,
            sec;

        sec = duration/1000;
        hours = Math.floor(sec/3600);
        sec = sec%3600;
        min = Math.floor(sec/60);
        sec = Math.floor(sec%60);

        return `${hours}:${min}:${sec}`;
    };

    ExecutionIndexWidget.prototype.updateTime = function (id, force) {
        var desc = this.nodes[id].desc,
            duration = 'unknown';

        if (desc.status === 'running') {
            if (desc.startTime) {
                duration = this.getDurationText(Date.now() - desc.startTime);
            }
            this.nodes[id].$duration.text(duration);
            return true;
        } else if (force) {
            if (desc.endTime && desc.startTime) {
                duration = this.getDurationText(desc.endTime - desc.startTime);
            }
            this.nodes[id].$duration.text(duration);
            return true;
        }
        return false;
    };

    ExecutionIndexWidget.prototype.updateTimes = function () {
        var nodeIds = Object.keys(this.nodes),
            updated = false;

        for (var i = nodeIds.length; i--;) {
            updated = this.updateTime(nodeIds[i]) || updated;
        }
        
        if (updated) {  // if there are still nodes, call again!
            setTimeout(this.updateTimes.bind(this), 1000);
        }
    };

    ExecutionIndexWidget.prototype.removeNode = function (id) {
        if (this.nodes[id]) {
            this.nodes[id].$el.remove();
        } else if (this.graphs[id]) {
            delete this.graphs[id];
        }
        delete this.nodes[id];

        this.lineGraph.removeNode(id);  // 'nop' if node is not line
    };

    ExecutionIndexWidget.prototype.updateSelected = function (desc) {
        // If the running pipeline has been unselected, don't reselect it!
        if (desc.status === 'running') {
            this.hasRunning = true;
            this.setSelect(desc.id, true);
            if (this.defaultSelection) {
                this.setSelect(this.defaultSelection, false);
            }
        } else if (!this.hasRunning && !this.defaultSelection) {
            this.defaultSelection = desc.id;
            this.setSelect(desc.id, true);
        }
        
    };

    ExecutionIndexWidget.prototype.toggleAbbreviations = function (show, ids) {
        var node,
            desc,
            name;

        ids = ids || this.checkedIds;
        for (var i = ids.length; i--;) {
            node = this.nodes[ids[i]];
            desc = node.desc;
            name = show ? `${desc.name} (${desc.abbr})` : desc.name;
            node.$name.text(name);
        }
    };

    ExecutionIndexWidget.prototype.setSelect = function (id, checked) {
        var wasChecked = this.checkedIds.length > 1,
            isChecked;

        this.nodes[id].$checkbox.checked = checked;

        // If multiple are checked, display the abbreviation
        if (checked) {
            this.checkedIds.push(id);
        } else {
            var k = this.checkedIds.indexOf(id);
            if (k !== -1) {
                this.checkedIds.splice(k, 1);
            }
        }

        isChecked = this.checkedIds.length > 1;
        if (isChecked !== wasChecked) {
            this.toggleAbbreviations(isChecked);
        }

        // Update the given node
        if (!checked || isChecked) {
            this.toggleAbbreviations(checked, [id]);
        }

        this.setExecutionDisplayed(id, checked);
    };

    ExecutionIndexWidget.prototype.updateNode = function (desc) {
        var node = this.nodes[desc.id];
        if (node) {
            node.$name.text(desc.name);
            node.$el.removeClass(node.statusClass);
            node.$el.addClass(Utils.ClassForJobStatus[desc.status]);

            if (Utils.ClassForJobStatus[desc.status] !== node.statusClass) {
                // Only update the selection if the status has changed.
                // ie, it has started running
                this.updateSelected(desc);
            }
            this._logger.debug(`setting execution ${desc.id} to ${desc.status}`);

            node.statusClass = Utils.ClassForJobStatus[desc.status];
            node.desc = desc;
        } else if (desc.type === 'line') {
            this.lineGraph.updateNode(desc);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ExecutionIndexWidget.prototype.destroy = function () {
    };

    ExecutionIndexWidget.prototype.onActivate = function () {
        this._logger.debug('ExecutionIndexWidget has been activated');
    };

    ExecutionIndexWidget.prototype.onDeactivate = function () {
        this._logger.debug('ExecutionIndexWidget has been deactivated');
    };

    return ExecutionIndexWidget;
});
