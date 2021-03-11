/* globals define */

define([
    './lib/vscode-ws-jsonrpc.min',
    './lib/monaco-languageclient.min',
    './lib/reconnecting-websocket.min',
], function (
    vscodeWSJSONRpc,
    LanguageClient,
    RS
) {
    const {ReconnectingWebSocket} = RS,
        {listen} = vscodeWSJSONRpc;
    const {
        MonacoLanguageClient,
        CloseAction,
        ErrorAction,
        Services,
        MonacoCommands,
        MonacoWorkspace,
        ConsoleWindow,
        MonacoLanguages,
        MonacoToProtocolConverter,
        ProtocolToMonacoConverter,
        createConnection
    } = LanguageClient;

    class DeepForgeLanguageClient {
        constructor(editor, serverURL, opts) {
            const services = createServices(editor, opts);
            Services.install(services);
            this.serverURL = serverURL;
            this.socket = createReconnectingWebSocket(this.serverURL, opts);
            this._initializeClient(opts);
        }

        _initializeClient(opts) {
            listen({
                webSocket: this.socket,
                onConnection: connection => {
                    const languageClient = createLanguageClient(connection, opts);
                    const disposable = languageClient.start();
                    connection.onClose(() => disposable.dispose());
                }
            });
        }
    }

    const createLanguageClient = function (connection, opts) {
        return new MonacoLanguageClient(
            {
                name: opts.name || 'DeepForge Language Client',
                clientOptions: {
                    documentSelector: [opts.language],
                    errorHandler: {
                        error: () => ErrorAction.Continue,
                        closed: () => CloseAction.DoNotRestart
                    },
                    middleware: {
                        workspace: {
                            configuration: (
                                params,
                                tokens,
                                configuration
                            ) => {
                                return Array(configuration(params, tokens).length).fill(
                                    {}
                                );
                            }
                        }
                    },
                    initializationOptions: opts.initializationOptions || {}
                },
                connectionProvider: {
                    get(errorHandler, closeHandler) {
                        return Promise.resolve(
                            createConnection(connection, errorHandler, closeHandler)
                        );
                    }
                }
            }
        );
    };

    const createReconnectingWebSocket = function (url, opts = {}) {
        const socketOpts = {
            maxReconnectionDelay: opts.socket.maxReconnectionDelay || 10000,
            minReconnectionDelay: opts.socket.minReconnectionDelay || 1000,
            reconnectionDelayGrowFactor: opts.socket.reconnectionDelayGrowFactor || 1.3,
            connectionTimeout: 10000,
            maxRetries: Infinity,
            debug: opts.socket.debug || false
        };

        return new ReconnectingWebSocket(
            url,
            [],
            socketOpts
        );
    };

    const createServices = function (editor, opts) {
        const m2p = new MonacoToProtocolConverter();
        const p2m = new ProtocolToMonacoConverter();
        let services = {
            commands: new MonacoCommands(editor),
            languages: new MonacoLanguages(p2m, m2p),
            workspace: new MonacoWorkspace(p2m, m2p, opts.rootUri)
        };
        // if (opts.debug) {
        //     services.window = new ConsoleWindow();
        // }

        services.window = new ConsoleWindow();

        return services;
    };

    return DeepForgeLanguageClient;
});
