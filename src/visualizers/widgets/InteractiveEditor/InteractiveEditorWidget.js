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
    const COMPUTE_LOADING_MESSAGE = 'Connecting to Compute Instance...';
    const LoaderHTML = '<div class="lds-ripple"><div></div><div></div></div>';
    class InteractiveEditorWidget {
        constructor(container) {
            this.showComputeShield(container);
        }

        showComputeShield(container) {
            const overlay = $('<div>', {class: 'compute-shield'});
            container.append(overlay);
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
                    this.session = await this.createInteractiveSession(id, config, overlay);
                    const features = this.getCapabilities();
                    if (features.save) {
                        DeepForge.registerAction('Save', 'save', 10, () => this.save());
                    }
                    overlay.remove();
                    this.onComputeInitialized(this.session);
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

        showComputeLoadingStatus(status, overlay) {
            const msg = overlay.find('.subtitle');
            const loader = overlay.find('.lds-ripple');
            const title = overlay.find('.title');

            title.text(COMPUTE_LOADING_MESSAGE);
            loader.removeClass('hidden');
            msg.removeClass('hidden');
            return msg;
        }

        updateComputeLoadingStatus(status, subtitle) {
            const displayText = status === 'running' ?
                'Configuring environment' :
                status.substring(0, 1).toUpperCase() + status.substring(1);
            subtitle.text(`${displayText}...`);
        }

        async createInteractiveSession(computeId, config, overlay) {
            const createSession = Session.new(computeId, config);

            const msg = this.showComputeLoadingStatus(status, overlay);
            this.updateComputeLoadingStatus('Connecting', msg);
            createSession.on(
                'update',
                status => this.updateComputeLoadingStatus(status, msg)
            );
            const session = await createSession;
            return session;
        }

        destroy() {
            const features = this.getCapabilities();
            if (features.save) {
                DeepForge.unregisterAction('Save');
            }
            this.session.close();
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
