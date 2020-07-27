/*globals define, $*/
define([
    'deepforge/EventEmitter',
    'deepforge/storage/index',
    'underscore',
    'text!./ArtifactLoader.html',
    'css!./styles/ArtifactLoader.css',
], function(
    EventEmitter,
    Storage,
    _,
    Html,
) {
    class ArtifactLoader extends EventEmitter {
        constructor(container) {
            super();
            this.session = null;
            this.$el = container;
            this.$el.addClass('artifact-loader');
            this.$el.append($(Html));
            this.$artifacts = this.$el.find('.artifacts');
            this.artifacts = [];
            this.render = _.debounce(this.render.bind(this), 250);
        }

        register(desc) {
            this.artifacts.push(new Artifact(desc));
            this.render();
        }

        unregister(artifactId) {
            const index = this.artifacts.findIndex(artifact => artifact.id === artifactId);
            if (index > -1) {
                this.artifacts.splice(index, 1);
                this.render();
            }
        }

        async load(artifact) {
            const desc = artifact.data;
            const dataInfo = JSON.parse(desc.data);
            const config = await this.getAuthenticationConfig(dataInfo);

            const pyName = desc.name.replace(/\..*$/, '');
            const loading = this.session.addArtifact(pyName, dataInfo, desc.type, config);
            artifact.state = ArtifactState.LOADING;
            this.render();
            await loading;
            artifact.state = ArtifactState.LOADED;
            this.render();
            this.emit('load', desc);
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

        render() {
            this.$artifacts.empty();
            this.artifacts.forEach(artifact => {
                const $element = artifact.element();
                if (artifact.state === ArtifactState.NOT_LOADED) {
                    $element.on('click', event => {
                        event.stopPropagation();
                        event.preventDefault();
                        this.load(artifact);
                    });
                }
                this.$artifacts.append($element);
            });
        }
    }

    class ArtifactState {
        constructor(clazz, text, icon) {
            this.class = clazz || '';
            this.text = text || '';
            this.icon = icon || '';
        }

        configure($element) {
            if (this.text) {
                const $state = $('<span>', {class: 'pull-right artifact-state'});
                $state.text(this.text);
                $element.append($state);
            }
            if (this.class) {
                $element.addClass(this.class);
            }
            if (this.icon) {
                const $icon = glyph(this.icon);
                $element.append($icon);
            }
        }
    }

    ArtifactState.LOADING = new ArtifactState('list-group-item-warning', 'Loading...');
    ArtifactState.NOT_LOADED = new ArtifactState(null, null, 'upload');
    ArtifactState.LOADED = new ArtifactState('list-group-item-success', 'Available');

    class Artifact {
        constructor(data) {
            this.id = data.id;
            this.data = data;
            this.state = ArtifactState.NOT_LOADED;
        }

        element() {
            const $element = $('<li>', {class: 'list-group-item'});
            $element.text(this.data.name);

            this.state.configure($element);

            return $element;
        }
    }

    function glyph(name) {
        const $el = $('<span>', {class: `glyphicon glyphicon-${name} pull-right`});
        $el.attr('aria-hidden', true);
        return $el;
    }

    return ArtifactLoader;
});
