import { Disposable, ExtensionContext, workspace } from 'vscode';

const HAPROXY_LANGUAGE_ID = 'haproxy';

interface DocumentLike {
  readonly languageId: string;
}

/** VS Code calls the lazy start needs, injectable for unit tests. */
export interface DocumentEventsApi {
  textDocuments(): readonly DocumentLike[];
  onDidOpenTextDocument(listener: (doc: DocumentLike) => void): Disposable;
}

const vscodeApi: DocumentEventsApi = {
  textDocuments: () => workspace.textDocuments,
  onDidOpenTextDocument: (listener) => workspace.onDidOpenTextDocument(listener),
};

/** A start action that runs at most once, however many callers request it. */
export interface StartOnce {
  start(): Promise<boolean>;
  hasStarted(): boolean;
}

/**
 * Wrap a start action so repeated calls share the first attempt.
 * @param start Action that starts the language server and resolves to its success.
 */
export function createStartOnce(start: () => Promise<boolean>): StartOnce {
  let attempt: Promise<boolean> | undefined;
  return {
    start: () => (attempt ??= start()),
    hasStarted: () => attempt !== undefined,
  };
}

/**
 * Call `start` once the first HAProxy document is open. VS Code re-fires the open
 * event when a document's language changes, so detected files also trigger it.
 * @param context Extension context that owns the listener.
 * @param start Called at most once.
 * @param api VS Code calls; replaced in tests.
 */
export function startWhenHaproxyAppears(
  context: ExtensionContext,
  start: () => void,
  api: DocumentEventsApi = vscodeApi
): void {
  if (api.textDocuments().some(isHaproxy)) {
    start();
    return;
  }
  const listener = api.onDidOpenTextDocument((doc) => {
    if (!isHaproxy(doc)) return;
    listener.dispose();
    start();
  });
  context.subscriptions.push(listener);
}

function isHaproxy(doc: DocumentLike): boolean {
  return doc.languageId === HAPROXY_LANGUAGE_ID;
}
