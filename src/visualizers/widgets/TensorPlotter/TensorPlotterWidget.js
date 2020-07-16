/*globals define, $ */

define([
    'widgets/InteractiveExplorer/InteractiveExplorerWidget',
    'deepforge/storage/index',
    'deepforge/compute/interactive/session-with-queue',
    'widgets/PlotlyGraph/lib/plotly.min',
    './PlotEditor',
    './ArtifactLoader',
    'underscore',
    'text!./files/explorer_helpers.py',
    'deepforge/viz/InformDialog',
    'css!./styles/TensorPlotterWidget.css',
], function (
    InteractiveExplorerWidget,
    Storage,
    Session,
    Plotly,
    PlotEditor,
    ArtifactLoader,
    _,
    HELPERS_PY,
    InformDialog,
) {
    'use strict';

    const WIDGET_CLASS = 'tensor-plotter';

    class TensorPlotterWidget extends InteractiveExplorerWidget {
        constructor(logger, container) {
            super(container);
            this._logger = logger.fork('Widget');
            this.currentPlotData = null;

            this.session = null;
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

        async createInteractiveSession(computeId, config) {
            this.session = await Session.new(computeId, config);
            this.initSession();
            this.artifactLoader.session = this.session;
        }

        async getAuthenticationConfig (dataInfo) {
            const {backend} = dataInfo;
            const metadata = Storage.getStorageMetadata(backend);
            metadata.configStructure = metadata.configStructure
                .filter(option => option.isAuth);

            if (metadata.configStructure.length) {
                const configDialog = this.getConfigDialog();
                const title = `Authenticate with ${metadata.name}`;
                const iconClass = `glyphicon glyphicon-download-alt`;
                const config = await configDialog.show(metadata, {title, iconClass});

                return config[backend];
            }
        }

        async initSession () {
            await this.session.whenConnected();
            const initCode = await this.getInitializationCode();
            await this.session.addFile('utils/init.py', initCode);
            await this.session.addFile('utils/explorer_helpers.py', HELPERS_PY);
        }

        async exec(cmd) {
            try {
                const {stdout} = await this.session.exec(cmd);
                return stdout;
            } catch (err) {
                const prettyCmd = cmd.split(';').join('\n');
                const {stderr} = err.jobResult;
                const msg = `Command:\n\n${prettyCmd}\nError logs:\n\n${stderr}`;
                const dialog = new InformDialog('Command failed.', msg);
                dialog.show();
                throw err;
            }
        }

        async getPoints (lineInfo) {
            const {data, dataSlice=''} = lineInfo;
            const [artifactName, ...accessors] = data.split('[');
            const accessor = accessors.length ? '[' + accessors.join('[') : '';
            const command = [
                'import utils.init',
                `from artifacts.${artifactName} import data`,
                'from utils.explorer_helpers import print_points',
                `print_points(data${accessor}${dataSlice})`
            ].join(';');
            const stdout = await this.exec(`python -c '${command}'`);
            return JSON.parse(stdout);
        }

        async getColorValues (lineInfo) {
            const {colorData, colorDataSlice='', startColor, endColor} = lineInfo;
            const [artifactName, ...accessors] = colorData.split('[');
            const accessor = accessors.length ? '[' + accessors.join('[') : '';
            const command = [
                'import utils.init',
                `from artifacts.${artifactName} import data`,
                'from utils.explorer_helpers import print_colors',
                `data = data${accessor}${colorDataSlice}`,
                `print_colors(data, "${startColor}", "${endColor}")`
            ].join(';');
            const stdout = await this.exec(`python -c '${command}'`);
            return JSON.parse(stdout);
        }

        async getMetadata (desc) {
            const {name} = desc;
            const pyName = name.replace(/\..*$/, '');
            const command = [
                'import utils.init',
                `from artifacts.${pyName} import data`,
                'from utils.explorer_helpers import print_metadata',
                `print_metadata("${name}", data)`,
            ].join(';');
            const stdout = await this.exec(`python -c '${command}'`);
            return JSON.parse(stdout);
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
            this._logger.debug('Widget is resizing...');
        }

        defaultLayout(desc) {
            const title = `Distribution of Labels for ${desc.name}`;
            return {title};
        }

        async getPlotlyJSON (figureData) {
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

        updateNode (/*desc*/) {
            // TODO: handle node changes, etc
        }

        /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
        destroy () {
            Plotly.purge(this.$plot[0]);
            if (this.session) {
                this.session.close();
            }
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
