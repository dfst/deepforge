/* globals define, $, jscolor */
define([
    'underscore',
    './DataEditorBase',
    './PythonSliceParser',
    'text!./PlottedDataEditor.html',
    './lib/jscolor',
], function(
    _,
    DataEditorBase,
    PythonSliceParser,
    Html,
) {

    const {InvalidSliceError} = PythonSliceParser;
    Html = _.template(Html);
    class PlottedDataEditor extends DataEditorBase {
        constructor(plottedData, dataShapes) {
            const isNewData = !plottedData;
            const title = isNewData ? `Add data to figure` :
                `Edit "${plottedData.name}"`;

            const fields = ['id', 'name', 'data', 'dataSlice', 'colorData',
                'colorDataSlice', 'colorType', 'uniformColor', 'startColor',
                'endColor'];
            super(Html({title}), fields);
            this.setDataOptions(dataShapes);

            if (!isNewData) {
                this.set(plottedData);
                this.id = plottedData.id;
            } else {
                this.id = Date.now();
            }

            this.$update = this.$el.find('.btn-primary');
            this.$dataShape = this.$el.find('.data-shape');
            const onDataUpdate = _.debounce(() => this.validateAllPythonData(), 250);
            const onDataChange = _.debounce(() => this.validateAllPythonData(true), 250);

            this.dataShapes = dataShapes;
            this.$el.find('#dataSlice').on('input', onDataUpdate);
            this.$el.find('#colorDataSlice').on('input', onDataUpdate);
            this.$el.find('#data').on('change', onDataChange);
            this.$el.find('#colorData').on('change', onDataChange);

            const colorInputs = Array.prototype.slice.call(this.$el.find('.jscolor'));
            colorInputs.forEach(input => new jscolor(input, {zIndex: 10000}));

            const colorType = isNewData ? 'uniform' : plottedData.colorType;
            this.showColorOptions(colorType);
            this.$elements.colorType.on('change', () => {
                const type = this.$elements.colorType.val();
                this.showColorOptions(type);
            });
        }

        showColorOptions(colorType) {
            this.$el.find('.color-type').css('display', 'none');
            this.$el.find(`.color-type.${colorType}`).css('display', 'block');
        }

        validate() {
            let isValid = this.validateAllPythonData();
            return this.validateName() && isValid;
        }

        setDataOptions(dataShapes) {
            const $data = this.$el.find('.artifactData');
            $data.empty();
            const names = dataShapes
                .flatMap(md => PlottedDataEditor.getAllVariableNames(md));
            const options = names.map(name => {
                const $el = $('<option>');
                $el.attr('value', name);
                $el.text(name);
                return $el;
            });
            options.forEach($opt => $data.append($opt));
        }

        static getAllVariableNames(metadata, isKey=false) {
            const name = isKey ? `["${metadata.name}"]` : metadata.name;

            if (metadata.entries) {
                const names = metadata.entries
                    .flatMap(entry => PlottedDataEditor.getAllVariableNames(entry, true));

                return names.map(n => name + n);
            }

            return [name];
        }

        async show() {
            this.$el.modal('show');
            this.validateAllPythonData();
            return new Promise(resolve => {
                this.$update.on('click', event => {
                    if (this.validate()) {
                        this.$el.modal('hide');
                        event.stopPropagation();
                        event.preventDefault();
                        resolve(this.data());
                    }
                });
            });
        }

        data(shallow) {
            const data = super.data();
            data.id = this.id;
            if (!shallow) {
                data.shape = this.getPythonDataShape(data.data, data.dataSlice);
            }
            return data;
        }

        validateAllPythonData(showSyntaxErrors = false) {
            const $shapes = Array.prototype.slice.call(this.$dataShape);
            return $shapes.reduce(
                (valid, $shape) => this.validatePythonData($shape, showSyntaxErrors) && valid,
                true
            );
        }

        validatePythonData($shape, showSyntaxErrors) {
            const dataName = $shape.getAttribute('data-data');
            const sliceName = $shape.getAttribute('data-slice');
            const data = this.data(true);
            try {
                const shape = this.getPythonDataShape(data[dataName], data[sliceName]);
                const displayShape = `(${shape.join(', ')})`;
                $shape.innerText = displayShape;
                this.$elements[sliceName].parent().removeClass('has-error');
                return true;
            } catch (err) {
                const isSyntaxError = err instanceof InvalidSliceError;
                const showError = !isSyntaxError || showSyntaxErrors;
                if (showError) {
                    this.$elements[sliceName].parent().addClass('has-error');
                    $shape.innerText = err.message;
                }
                return false;
            }
        }

        validateName() {
            const name = this.$elements.name.val();
            const isValid = !!name.trim();
            if (!isValid) {
                this.$elements.name.parent().addClass('has-error');
            } else {
                this.$elements.name.parent().removeClass('has-error');
            }

            return isValid;
        }

        findMetadataEntry(metadata, varName) {
            if (varName === metadata.name) {
                return metadata;
            }

            const isDict = !!metadata.entries;
            if (isDict && varName.startsWith(metadata.name)) {
                const nextEntry = metadata.entries
                    .find(md => {
                        const {name} = md;
                        const entryVarName = `${metadata.name}["${name}"]`;

                        return varName.startsWith(entryVarName);
                    });

                const relVarName = varName
                    .replace(`${metadata.name}["${nextEntry.name}"]`, nextEntry.name);
                return this.findMetadataEntry(nextEntry, relVarName);
            }
        }

        getInitialDataShape(nameString) {
            const metadata = this.dataShapes
                .map(metadata => this.findMetadataEntry(metadata, nameString))
                .find(md => md);

            if (!metadata) {
                throw new Error(`Could not find metadata for ${nameString}`);
            }

            return metadata.shape;
        }

        getPythonDataShape(data, dataSlice='') {
            const startShape = this.getInitialDataShape(data);
            const shape = PythonSliceParser(startShape, dataSlice);
            return shape;
        }
    }

    return PlottedDataEditor;
});
