import { Disposable, ExtensionContext, languages, TextDocument, workspace } from 'vscode';
import { isDetectionCandidate, looksLikeHaproxyConfig } from './haproxyDetection';

const HAPROXY_LANGUAGE_ID = 'haproxy';

/** VS Code calls the controller needs, injectable for unit tests. */
export interface DetectionApi {
  textDocuments(): readonly TextDocument[];
  onDidOpenTextDocument(listener: (doc: TextDocument) => void): Disposable;
  setTextDocumentLanguage(doc: TextDocument, languageId: string): Thenable<TextDocument>;
}

const vscodeApi: DetectionApi = {
  textDocuments: () => workspace.textDocuments,
  onDidOpenTextDocument: (listener) => workspace.onDidOpenTextDocument(listener),
  setTextDocumentLanguage: (doc, languageId) => languages.setTextDocumentLanguage(doc, languageId),
};

/**
 * Switch generic .cfg/.conf documents that contain HAProxy section headers to the
 * HAProxy language, both for documents already open and for ones opened later.
 * Each document is evaluated once per session: VS Code re-fires the open event when the
 * language changes, and a manual language choice must not be overridden.
 * @param context Extension context that owns the listener.
 * @param api VS Code calls; replaced in tests.
 */
export function registerHaproxyDetection(context: ExtensionContext, api: DetectionApi = vscodeApi): void {
  const evaluated = new Set<string>();

  const detect = (doc: TextDocument): void => {
    const key = doc.uri.toString();
    if (evaluated.has(key)) return;
    evaluated.add(key);

    const candidate = isDetectionCandidate({
      languageId: doc.languageId,
      fileName: doc.fileName,
      uriScheme: doc.uri.scheme,
    });
    if (!candidate || !looksLikeHaproxyConfig(doc.getText())) return;
    Promise.resolve(api.setTextDocumentLanguage(doc, HAPROXY_LANGUAGE_ID)).catch(() => undefined);
  };

  context.subscriptions.push(api.onDidOpenTextDocument(detect));
  api.textDocuments().forEach(detect);
}
