/* globals define, $ */
define([
    'deepforge/compute/interactive/session-with-queue',
    'deepforge/viz/ConfigDialog',
    'deepforge/viz/InformDialog',
    'deepforge/compute/index',
    'deepforge/globals',
    'css!./styles/InteractiveEditorWidget.css',
], function(
    Session,
    ConfigDialog,
    InformDialog,
    Compute,
    DeepForge,
) {
    const COMPUTE_MESSAGE = 'Compute Required. Click to configure.';
    class InteractiveEditorWidget {
        constructor(container) {
            this.showComputeShield(container);
        }

        showComputeShield(container) {
            const overlay = $('<div>', {class: 'compute-shield'});
            container.append(overlay);
            const msg = $('<span>');
            msg.text(COMPUTE_MESSAGE);
            overlay.append(msg);
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
                    // TODO: Detect authorization errors...
                    const dialog = new InformDialog(title, body);
                    dialog.show();
                }
            });
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

        async createInteractiveSession(computeId, config) {
            this.session = await Session.new(computeId, config);
        }

        destroy() {
            const features = this.getCapabilities();
            if (features.save) {
                DeepForge.unregisterAction('Save');
            }
        }
    }

    return InteractiveEditorWidget;
});
