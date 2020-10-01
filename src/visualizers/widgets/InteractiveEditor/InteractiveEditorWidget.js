/* globals define, $ */
define([
    'deepforge/viz/ConfigDialog',
    'deepforge/viz/InformDialog',
    'deepforge/compute/index',
    'deepforge/globals',
    'css!./styles/InteractiveEditorWidget.css',
], function(
    ConfigDialog,
    InformDialog,
    Compute,
    DeepForge,
) {
    const COMPUTE_MESSAGE = 'Compute Required. Click to configure.';
    const COMPUTE_LOADING_MESSAGE = 'Connecting to Compute Instance...';
    const LoaderHTML = '<div class="lds-ripple"><div></div><div></div></div>';
    class InteractiveEditorWidget {
        constructor(container) {
            this.$el = container;
        }

        showComputeShield() {
            const overlay = $('<div>', {class: 'compute-shield'});
            this.$el.append(overlay);
            overlay.append($('<div>', {class: 'filler'}));
            const loader = $(LoaderHTML);
            overlay.append(loader);
            const msg = $('<span>', {class: 'title'});
            overlay.append(msg);
            const subtitle = $('<span>', {class: 'subtitle'});
            overlay.append(subtitle);
            msg.text(COMPUTE_MESSAGE);
            loader.addClass('hidden');
            subtitle.addClass('hidden');

            overlay.on('click', async () => {
                const {id, config} = await this.promptComputeConfig();
                try {
                    await this.createInteractiveSession(id, config);
                    const features = this.getCapabilities();
                    if (features.save) {
                        DeepForge.registerAction('Save', 'save', 10, () => this.save());
                    }
                    overlay.remove();
                } catch (err) {
                    const title = 'Compute Creation Error';
                    const body = 'Unable to create compute. Please verify the credentials are correct.';
                    msg.text(COMPUTE_MESSAGE);
                    loader.addClass('hidden');
                    subtitle.addClass('hidden');

                    // TODO: Detect authorization errors...
                    const dialog = new InformDialog(title, body);
                    dialog.show();
                }
            });
        }

        onComputeInitialized(/*session*/) {
        }

        getCapabilities() {
            return {
                suspend: this.isOveridden('getEditorState') &&
                    this.isOveridden('resume'),
                save: this.isOveridden('getSnapshot') &&
                    this.isOveridden('getOperation') &&
                    this.isOveridden('getEditorState'),
            };
        }

        isOveridden(name) {
            return this[name] !== InteractiveEditorWidget.prototype[name];
        }

        async promptComputeConfig() {
            const dialog = new ConfigDialog();
            const computeMetadata = Compute.getAvailableBackends().map(id => Compute.getMetadata(id));
            const metadata = {
                id: 'InteractiveComputeConfig',
                name: 'Create Compute Instance',
                version: '1.0.0',
                description: '',
                icon: {
                    class: 'glyphicon glyphicon-cog',
                    src: ''
                },
                disableServerSideExecution: false,
                disableBrowserSideExecution: false,
                writeAccessRequired: false,
                configStructure: [
                    {
                        name: 'compute',
                        displayName: 'Compute',
                        description: 'Computational resources to use for execution.',
                        valueType: 'dict',
                        value: Compute.getBackend(Compute.getAvailableBackends()[0]).name,
                        valueItems: computeMetadata,
                    }
                ]
            };
            const allConfigs = await dialog.show(metadata);
            const {name, config} = allConfigs[metadata.id].compute;
            const id = computeMetadata.find(md => md.name === name).id;
            return {id, config};
        }

        showComputeLoadingStatus() {
            const overlay = this.$el.find('.compute-shield');
            this.$el.append(overlay);
            const msg = overlay.find('.subtitle');
            const loader = overlay.find('.lds-ripple');
            const title = overlay.find('.title');

            title.text(COMPUTE_LOADING_MESSAGE);
            loader.removeClass('hidden');
            msg.removeClass('hidden');
            return msg;
        }

        updateComputeLoadingStatus(status) {
            const subtitle = this.$el.find('.subtitle');
            const displayText = status === 'running' ?
                'Configuring environment' :
                status.substring(0, 1).toUpperCase() + status.substring(1);
            subtitle.text(`${displayText}...`);
        }

        destroy() {
            const features = this.getCapabilities();
            if (features.save) {
                DeepForge.unregisterAction('Save');
            }
        }

        updateNode(/*desc*/) {
        }

        onActivate() {
        }

        onDeactivate() {
        }

        onWidgetContainerResize(/*width, height*/) {
        }
    }

    return InteractiveEditorWidget;
});
