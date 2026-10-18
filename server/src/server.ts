import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  HoverParams,
  Hover,
  DocumentFormattingParams,
  TextEdit,
  DocumentSymbol,
  DocumentSymbolParams,
  Location,
  DefinitionParams,
  CodeAction,
  CodeActionParams,
  FoldingRange,
  FoldingRangeParams,
  DocumentHighlight,
  DocumentHighlightParams,
  ReferenceParams,
  WorkspaceEdit,
  RenameParams,
  PrepareRenameParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionProvider } from './completion/completionProvider';
import { HoverProvider } from './hover/hoverProvider';
import { FormattingProvider } from './formatting/formatter';
import { SymbolsProvider } from './symbols/symbolsProvider';
import { DefinitionProvider } from './definition/definitionProvider';
import { CodeActionsProvider } from './codeactions/codeActionsProvider';
import { FoldingProvider } from './folding/foldingProvider';
import { VersionRegistry } from './registry/versionRegistry';
import { ServerSettings, DEFAULT_SETTINGS, parseServerSettings } from './settings';
import { DocumentHighlightProvider } from './highlights/documentHighlightProvider';
import { ReferencesProvider } from './references/referencesProvider';
import { RenameProvider } from './rename/renameProvider';
import { DocumentState } from './documentState';
import { DocumentPipeline } from './documentPipeline';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments<TextDocument>(TextDocument);

const documentState = new DocumentState();
const astCache = documentState.astCache;

let settings: ServerSettings = { ...DEFAULT_SETTINGS };
let registry: VersionRegistry;
let hasConfigurationCapability = false;

const pipeline = new DocumentPipeline(connection, documentState, () => ({ settings, registry }));

connection.onInitialize((params: InitializeParams): InitializeResult => {
  hasConfigurationCapability = !!(
    params.capabilities.workspace && params.capabilities.workspace.configuration
  );

  registry = new VersionRegistry();

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [' ', '\n'],
      },
      hoverProvider: true,
      documentFormattingProvider: true,
      documentSymbolProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,
      renameProvider: { prepareProvider: true },
      codeActionProvider: true,
      foldingRangeProvider: true,
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    void connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  void refreshSettings();
});

connection.onDidChangeConfiguration(() => {
  void refreshSettings().then(() => {
    documents.all().forEach((doc) => pipeline.revalidate(doc));
  });
});

documents.onDidOpen((event) => pipeline.refresh(event.document));

documents.onDidChangeContent((event) => pipeline.refresh(event.document));

documents.onDidClose((event) => {
  documentState.release(event.document.uri);
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onShutdown(() => {
  documentState.releaseAll();
});

connection.onExit(() => {
  documentState.releaseAll();
});

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  if (!settings.completionEnabled) return [];
  const doc = documents.get(params.textDocument.uri);
  const ast = astCache.get(params.textDocument.uri);
  if (!doc || !ast) return [];

  // Extract the text of the current line up to the cursor for context detection.
  const lineStart = doc.offsetAt({ line: params.position.line, character: 0 });
  const cursorOffset = doc.offsetAt(params.position);
  const linePrefix = doc.getText().slice(lineStart, cursorOffset);

  const provider = new CompletionProvider(registry, settings.version);
  return provider.provideCompletions(ast, params.position, linePrefix);
});

connection.onHover((params: HoverParams): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  const ast = astCache.get(params.textDocument.uri);
  if (!doc || !ast) return null;
  const provider = new HoverProvider(registry, settings.version);
  return provider.provideHover(ast, params.position);
});

connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return [];
  return new FoldingProvider().provideFoldingRanges(ast);
});

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return [];
  return new CodeActionsProvider().provideCodeActions(ast, params.range, params.context.diagnostics);
});

connection.onDefinition((params: DefinitionParams): Location | null => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return null;
  return new DefinitionProvider().provideDefinition(ast, params.position);
});

connection.onDocumentHighlight((params: DocumentHighlightParams): DocumentHighlight[] => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return [];
  return new DocumentHighlightProvider().provideHighlights(ast, params.position);
});

connection.onReferences((params: ReferenceParams): Location[] => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return [];
  return new ReferencesProvider().provideReferences(ast, params.position, params.context.includeDeclaration);
});

connection.onPrepareRename((params: PrepareRenameParams) => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return null;
  return new RenameProvider().prepareRename(ast, params.position);
});

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return null;
  return new RenameProvider().provideRename(ast, params.position, params.newName);
});

connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
  const ast = astCache.get(params.textDocument.uri);
  if (!ast) return [];
  return new SymbolsProvider().provideSymbols(ast);
});

connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const provider = new FormattingProvider();
  return provider.format(doc, params.options);
});

async function refreshSettings(): Promise<void> {
  if (!hasConfigurationCapability) return;
  try {
    const config: unknown = await connection.workspace.getConfiguration('haproxy');
    settings = parseServerSettings(config);
  } catch {
    connection.console.error('Failed to retrieve HAProxy settings, using defaults.');
  }
}

documents.listen(connection);
connection.listen();
