/*globals define, $ */

define([
    'widgets/InteractiveExplorer/InteractiveExplorerWidget',
    'deepforge/storage/index',
    'webgme-plotly/plotly.min',
    './PlotEditor',
    './ArtifactLoader',
    'underscore',
    'deepforge/viz/InformDialog',
    'css!./styles/TensorPlotterWidget.css',
], function (
    InteractiveExplorerWidget,
    Storage,
    Plotly,
    PlotEditor,
    ArtifactLoader,
    _,
    InformDialog,
) {
    'use strict';

    const WIDGET_CLASS = 'tensor-plotter';

    class TensorPlotterWidget extends InteractiveExplorerWidget {
        constructor(logger, container) {
            super(container);
            this._logger = logger.fork('Widget');
            this.cmdCount = 0;
            this.currentPlotData = null;

            this.$el = container;
            this.$el.addClass(WIDGET_CLASS);
            const row = $('<div>', {class: 'row', style: 'height: 100%'});
            this.$el.append(row);

            this.$plot = $('<div>', {class: 'plot col-9', style: 'height: 100%'});

            const rightPanel = $('<div>', {class: 'col-3'});
            const $plotEditor = $('<div>', {class: 'plot-editor'});
            this.plotEditor = new PlotEditor($plotEditor);
            this.plotEditor.on('update', plotData => {
                this.updatePlot(plotData);
            });
            this.metadata = [];
            const $artifactLoader = $('<div>', {class: 'artifact-loader'});
            this.artifactLoader = new ArtifactLoader($artifactLoader);
            this.artifactLoader.getConfigDialog = () => this.getConfigDialog();
            this.artifactLoader.on('load', async desc => {
                this.metadata.push(await this.getMetadata(desc));
                this.plotEditor.set({metadata: this.metadata});
            });

            row.append(this.$plot);
            rightPanel.append($plotEditor);
            rightPanel.append($artifactLoader);
            row.append(rightPanel);

            this._logger.debug('ctor finished');
        }

        async getAuthenticationConfig (dataInfo) {
            const {backend} = dataInfo;
            const metadata = Storage.getStorageMetadata(backend);
            metadata.configStructure = metadata.configStructure
                .filter(option => option.isAuth);

            if (metadata.configStructure.length) {
                const configDialog = this.getConfigDialog();
                const title = `Authenticate with ${metadata.name}`;
                const iconClass = 'glyphicon glyphicon-download-alt';
                const config = await configDialog.show(metadata, {title, iconClass});

                return config[backend];
            }
        }

        async getPlotData (line) {
            const {shape} = line;
            const dim = shape[1];
            const dataDims = dim ? dim : 1;
            let x,y,z;
            let plotData = null;
            switch(dataDims) {
            case 1:
                plotData = {
                    y: await this.getPoints(line),
                    boxpoints: 'all',
                    jitter: 0.3,
                    pointpos: -1.8,
                    name: line.name,
                    type: 'box'
                };
                break;

            case 2:
                [x, y] = _.unzip(await this.getPoints(line));
                plotData = {
                    name: line.name,
                    mode: 'markers',  // lines
                    type: 'scatter',
                    x, y
                };
                break;

            case 3:
                [x, y, z] = _.unzip(await this.getPoints(line));
                plotData = {
                    name: line.name,
                    mode: 'markers',  // lines
                    type: 'scatter3d',
                    x, y, z
                };
                break;
            }
            await this.addPlotColor(plotData, line);
            return plotData;
        }

        async addPlotColor (plotData, line) {
            if (line.colorType === 'uniform') {
                plotData.marker = {
                    color: `#${line.uniformColor}`,
                    size: 2,
                };
            } else {
                const colors = await this.getColorValues(line);
                plotData.marker = {
                    color: colors,
                    size: 2
                };
            }
            return plotData;
        }

        onWidgetContainerResize (/*width, height*/) {
            if (this.currentPlotData) {
                const {data, layout} = this.currentPlotData;
                Plotly.newPlot(this.$plot[0], data, layout);
            } else {
                Plotly.newPlot(this.$plot[0]);
            }
        }

        defaultLayout(desc) {
            const title = `Distribution of Labels for ${desc.name}`;
            return {title};
        }

        async getPlotlyJSON (figureData) {
            try {
                const layout = _.pick(figureData, ['title', 'xaxis', 'yaxis']);
                if (layout.xaxis) {
                    layout.xaxis = {title: layout.xaxis};
                }
                if (layout.yaxis) {
                    layout.yaxis = {title: layout.yaxis};
                }
                const data = [];
                for (let i = 0; i < figureData.data.length; i++) {
                    data.push(await this.getPlotData(figureData.data[i]));
                }
                return {data, layout};
            } catch (err) {
                const {stderr, code} = err;
                const msg = `Command:<br/><pre><code>${code}</code></pre><br/>` +
                    `Error logs:<br/><pre><code>${stderr}</code></pre>`;
                const dialog = new InformDialog('Plotting failed.', msg);
                dialog.show();
                throw err;
            }
        }

        async updatePlot (figureData) {
            this.currentPlotData = await this.getPlotlyJSON(figureData);
            const {data, layout} = this.currentPlotData;
            Plotly.newPlot(this.$plot[0], data, layout);
        }

        // Adding/Removing/Updating items
        async addNode (desc) {
            this.artifactLoader.register(desc);
            Plotly.react(this.$plot[0]);
        }

        removeNode (gmeId) {
            this.artifactLoader.unregister(gmeId);
        }

        /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
        destroy () {
            Plotly.purge(this.$plot[0]);
        }

        onActivate () {
            this._logger.debug('TensorPlotterWidget has been activated');
        }

        onDeactivate () {
            this._logger.debug('TensorPlotterWidget has been deactivated');
        }

        getSnapshot() {
            const plotlyJSON = this.currentPlotData || {};
            const data = this.plotEditor.data();
            const name = data.title ? `Graph of ${data.title}` : 'Graph';

            return {
                type: 'pipeline.Graph',
                attributes: {
                    name,
                    title: data.title || '',
                    data: JSON.stringify(plotlyJSON)
                },
            };
        }

    }

    return TensorPlotterWidget;
});
