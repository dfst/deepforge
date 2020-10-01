/*globals define */

define([
    'panels/InteractiveExplorer/InteractiveExplorerControl',
    'text!./explorer_helpers.py',
], function (
    InteractiveExplorerControl,
    HELPERS_PY,
) {

    'use strict';

    class TensorPlotterControl extends InteractiveExplorerControl {

        initializeWidgetHandlers (widget) {
            super.initializeWidgetHandlers(widget);
            widget.getPoints = lineInfo => this.getPoints(lineInfo);
            widget.getColorValues = lineInfo => this.getColorValues(lineInfo);
            widget.getMetadata = desc => this.getMetadata(desc);
        }

        async onComputeInitialized (session) {
            super.onComputeInitialized(session);
            this._widget.artifactLoader.session = session;
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
            await session.addFile('utils/explorer_helpers.py', HELPERS_PY);
        }

        async getPoints (lineInfo) {
            const {data, dataSlice=''} = lineInfo;
            const {pyImport, varName} = this.getImportCode(data);
            const command = [
                'import utils.init',
                pyImport,
                'from utils.explorer_helpers import print_points',
                `print_points(${varName}${dataSlice})`
            ].join('\n');
            const stdout = await this.execPy(command);
            return JSON.parse(stdout);
        }

        async getColorValues (lineInfo) {
            const {colorData, colorDataSlice='', startColor, endColor} = lineInfo;
            const {pyImport, varName} = this.getImportCode(colorData);
            const command = [
                'import utils.init',
                pyImport,
                'from utils.explorer_helpers import print_colors',
                `data = ${varName}${colorDataSlice}`,
                `print_colors(data, "${startColor}", "${endColor}")`
            ].join('\n');
            const stdout = await this.execPy(command);
            return JSON.parse(stdout);
        }

        async getMetadata (desc) {
            const {name} = desc;
            const {pyImport, varName} = this.getImportCode(name);
            const command = [
                'import utils.init',
                pyImport,
                'from utils.explorer_helpers import print_metadata',
                `print_metadata("${varName}", ${varName})`,
            ].join('\n');
            const stdout = await this.execPy(command);
            return JSON.parse(stdout);
        }

        getImportCode (artifactName) {
            const pyName = artifactName.replace(/\..*$/, '');
            const [modName, ...accessors] = pyName.split('[');
            const pyImport = `from artifacts.${modName} import data as ${modName}`;
            const accessor = accessors.length ? '[' + accessors.join('[') : '';
            const varName = modName + accessor;
            return {
                pyImport, varName
            };
        }

        async execPy(code) {
            try {
                const i = ++this.cmdCount;
                await this.session.addFile(`cmd_${i}.py`, code);
                const {stdout} = await this.session.exec(`python cmd_${i}.py`);
                await this.session.removeFile(`cmd_${i}.py`);
                return stdout;
            } catch (err) {
                const {stderr} = err.jobResult;
                const wrappedError = new Error(err.message);
                wrappedError.stderr = stderr;
                wrappedError.code = code;
                throw wrappedError;
            }
        }

        getObjectDescriptor(nodeId) {
            const desc = super.getObjectDescriptor(nodeId);

            if (desc) {
                const node = this.client.getNode(nodeId);
                desc.data = node.getAttribute('data');
                desc.type = node.getAttribute('type');
            }

            return desc;
        }

        getTerritory(nodeId) {
            const territory = {};
            const node = this.client.getNode(nodeId);
            const parentId = node.getParentId();
            territory[parentId] = {children: 1};

            const omitParentNode = event => event.eid !== parentId;
            this.territoryEventFilters = [omitParentNode];

            return territory;
        }
    }

    return TensorPlotterControl;
});
