/* globals define, $ */
define([
    'underscore',
    './DataEditorBase',
    './PlottedDataEditor',
    'text!./PlotEditor.html',
], function(
    _,
    DataEditorBase,
    PlottedDataEditor,
    PlotEditorHtml,
) {

    class PlotEditor extends DataEditorBase {
        constructor(container) {
            container.append($(PlotEditorHtml));
            super(container, ['title', 'xaxis', 'yaxis'], true);
            this.$addData = this.$el.find('button');
            this.$addData.on('click', event => {
                event.stopPropagation();
                event.preventDefault();
                this.onAddDataClicked();
            });

            this.$plottedData = this.$el.find('.plotted-data');
            this.plottedData = [];
            this.metadata = [];
        }

        async onAddDataClicked() {
            const editor = new PlottedDataEditor(null, this.metadata);
            const data = await editor.show();
            if (data) {
                this.plottedData.push(data);
                this.refreshPlottedDataList();
                this.onUpdate();
            }
        }
        
        set(values) {
            super.set(values);
            if (values.plottedData) {
                this.plottedData = values.plottedData;
                this.refreshPlottedDataList();
            }
            this.metadata = values.metadata;
        }

        refreshPlottedDataList() {
            this.$plottedData.empty();
            this.plottedData.forEach(data => {
                const element = this.createPlottedElement(data);
                this.$plottedData.append(element);
            });
        }

        createPlottedElement(data) {
            const editClass = 'glyphicon-pencil';
            const removeClass = 'glyphicon-remove';
            const element = $(
                `<li class="list-group-item">${data.name}
                <span style="padding-left: 5px;" class="glyphicon ${removeClass} pull-right" aria-hidden="true"></span>
                <span class="glyphicon ${editClass} pull-right" aria-hidden="true"></span>
                </li>`
            );
            element.find(`.${editClass}`)
                .on('click', () => this.editPlottedData(data));
            element.find(`.${removeClass}`)
                .on('click', () => this.removePlottedData(data));
            return element;
        }

        async editPlottedData(data) {
            const editor = new PlottedDataEditor(data, this.metadata);
            const newData = await editor.show();
            const index = this.plottedData.findIndex(d => d.id === newData.id);
            if (index > -1) {
                this.plottedData.splice(index, 1, newData);
                this.refreshPlottedDataList();
                this.onUpdate();
            }
        }

        removePlottedData(data) {
            const index = this.plottedData.findIndex(d => d.id === data.id);
            if (index > -1) {
                this.plottedData.splice(index, 1);
                this.refreshPlottedDataList();
                this.onUpdate();
            }
        }

        data() {
            const values = super.data();
            values.data = this.plottedData;
            return values;
        }
    }

    return PlotEditor;
});
