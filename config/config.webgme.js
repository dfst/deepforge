// DO NOT EDIT THIS FILE
// This file is automatically generated from the webgme-setup-tool.
'use strict';


var config = require('webgme/config/config.default'),
    validateConfig = require('webgme/config/validator');

// The paths can be loaded from the webgme-setup.json
config.plugin.basePaths.push(__dirname + '/../src/plugins');
config.plugin.basePaths.push(__dirname + '/../node_modules/webgme-simple-nodes/src/plugins');
config.visualization.layout.basePaths.push(__dirname + '/../src/layouts');
config.visualization.layout.basePaths.push(__dirname + '/../node_modules/webgme-chflayout/src/layouts');
config.visualization.decoratorPaths.push(__dirname + '/../src/decorators');
config.visualization.decoratorPaths.push(__dirname + '/../node_modules/webgme-easydag/src/decorators');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/devTests');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/devUtilTests');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/pipeline');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/devPipelineTests');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/project');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/devProject');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/minimal');
config.seedProjects.basePaths.push(__dirname + '/../src/seeds/tests');



config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-fab/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-breadcrumbheader/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-autoviz/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-easydag/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-plotly/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../src/visualizers/panels');


config.rest.components['JobLogsAPI'] = {
  src: __dirname + '/../src/routers/JobLogsAPI/JobLogsAPI.js',
  mount: 'execution/logs',
  options: {}
};
config.rest.components['JobOriginAPI'] = {
  src: __dirname + '/../src/routers/JobOriginAPI/JobOriginAPI.js',
  mount: 'job/origins',
  options: {}
};
config.rest.components['ExecPulse'] = {
  src: __dirname + '/../src/routers/ExecPulse/ExecPulse.js',
  mount: 'execution/pulse',
  options: {}
};
config.rest.components['SciServerAuth'] = {
  src: __dirname + '/../src/routers/SciServerAuth/SciServerAuth.js',
  mount: 'routers/SciServerAuth',
  options: {}
};
config.rest.components['InteractiveCompute'] = {
  src: __dirname + '/../src/routers/InteractiveCompute/InteractiveCompute.js',
  mount: 'routers/InteractiveCompute',
  options: {}
};

// Visualizer descriptors
config.visualization.visualizerDescriptors.push(__dirname + '/../src/visualizers/Visualizers.json');
// Add requirejs paths
config.requirejsPaths = {
  'EllipseDecorator': 'node_modules/webgme-easydag/src/decorators/EllipseDecorator',
  'PlotlyGraph': 'panels/PlotlyGraph/PlotlyGraphPanel',
  'EasyDAG': 'panels/EasyDAG/EasyDAGPanel',
  'AutoViz': 'panels/AutoViz/AutoVizPanel',
  'BreadcrumbHeader': 'panels/BreadcrumbHeader/BreadcrumbHeaderPanel',
  'FloatingActionButton': 'panels/FloatingActionButton/FloatingActionButtonPanel',
  'CHFLayout': 'node_modules/webgme-chflayout/src/layouts/CHFLayout',
  'SimpleNodes': 'node_modules/webgme-simple-nodes/src/plugins/SimpleNodes',
  'panels': './src/visualizers/panels',
  'widgets': './src/visualizers/widgets',
  'panels/PlotlyGraph': './node_modules/webgme-plotly/src/visualizers/panels/PlotlyGraph',
  'widgets/PlotlyGraph': './node_modules/webgme-plotly/src/visualizers/widgets/PlotlyGraph',
  'panels/EasyDAG': './node_modules/webgme-easydag/src/visualizers/panels/EasyDAG',
  'widgets/EasyDAG': './node_modules/webgme-easydag/src/visualizers/widgets/EasyDAG',
  'panels/AutoViz': './node_modules/webgme-autoviz/src/visualizers/panels/AutoViz',
  'widgets/AutoViz': './node_modules/webgme-autoviz/src/visualizers/widgets/AutoViz',
  'panels/BreadcrumbHeader': './node_modules/webgme-breadcrumbheader/src/visualizers/panels/BreadcrumbHeader',
  'widgets/BreadcrumbHeader': './node_modules/webgme-breadcrumbheader/',
  'panels/FloatingActionButton': './node_modules/webgme-fab/src/visualizers/panels/FloatingActionButton',
  'widgets/FloatingActionButton': './node_modules/webgme-fab/src/visualizers/widgets/FloatingActionButton',
  'webgme-simple-nodes': './node_modules/webgme-simple-nodes/src/common',
  'webgme-chflayout': './node_modules/webgme-chflayout/src/common',
  'webgme-fab': './node_modules/webgme-fab/src/common',
  'webgme-breadcrumbheader': './node_modules/webgme-breadcrumbheader/src/common',
  'webgme-autoviz': './node_modules/webgme-autoviz/src/common',
  'webgme-easydag': './node_modules/webgme-easydag/src/common',
  'webgme-plotly': './node_modules/webgme-plotly/src/common',
  'deepforge': './src/common'
};


config.mongo.uri = 'mongodb://127.0.0.1:27017/deepforge';
validateConfig(config);
module.exports = config;
