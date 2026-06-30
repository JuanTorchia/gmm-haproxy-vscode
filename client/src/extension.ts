import * as path from 'path';
import {
  ExtensionContext,
  window,
  commands,
  StatusBarAlignment,
  StatusBarItem,
  workspace,
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let statusBarItem: StatusBarItem | undefined;

export function activate(context: ExtensionContext): void {
  try {
    client = createLanguageClient(context);
    statusBarItem = createStatusBarItem(context);

    registerCommands(context, client, statusBarItem);

    void client.start().then(() => {
      updateStatusBar(statusBarItem);
    });
  } catch (err) {
    void window.showErrorMessage(
      `HAProxy extension failed to activate: ${String(err)}. Check the HAProxy output channel.`
    );
  }
}

export function deactivate(): Thenable<void> | undefined {
  statusBarItem?.dispose();
  return client?.stop();
}

function createLanguageClient(context: ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'haproxy' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{cfg,conf}'),
    },
    outputChannelName: 'HAProxy',
    traceOutputChannel: window.createOutputChannel('HAProxy (Trace)', { log: true }),
  };

  return new LanguageClient('haproxy', 'HAProxy Language Server', serverOptions, clientOptions);
}

function createStatusBarItem(context: ExtensionContext): StatusBarItem {
  const item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  item.command = 'haproxy.selectVersion';
  item.tooltip = 'Click to change HAProxy validation version';
  context.subscriptions.push(item);
  return item;
}

function updateStatusBar(item: StatusBarItem | undefined): void {
  if (!item) return;
  const version = workspace.getConfiguration('haproxy').get<string>('version', '3.1');
  item.text = `$(server) HAProxy: ${version}`;
  item.show();
}

function registerCommands(
  context: ExtensionContext,
  lsClient: LanguageClient,
  statusBar: StatusBarItem | undefined
): void {
  context.subscriptions.push(
    commands.registerCommand('haproxy.restartServer', async () => {
      await lsClient.stop();
      await lsClient.start();
      updateStatusBar(statusBar);
      void window.showInformationMessage('HAProxy language server restarted.');
    })
  );

  context.subscriptions.push(
    commands.registerCommand('haproxy.selectVersion', async () => {
      const versions = ['2.4', '2.6', '2.8', '3.0', '3.1'];
      const current = workspace.getConfiguration('haproxy').get<string>('version', '3.1');
      const selected = await window.showQuickPick(
        versions.map((v) => ({
          label: v === '3.1' ? `${v} (latest)` : v === '2.8' ? `${v} (LTS)` : v,
          description: v === current ? '● active' : '',
          version: v,
        })),
        { placeHolder: `Current: HAProxy ${current} — select version to validate against` }
      );
      if (selected) {
        await workspace
          .getConfiguration('haproxy')
          .update('version', selected.version);
        updateStatusBar(statusBar);
      }
    })
  );

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e: { affectsConfiguration: (s: string) => boolean }) => {
      if (e.affectsConfiguration('haproxy.version')) {
        updateStatusBar(statusBar);
      }
    })
  );
}
