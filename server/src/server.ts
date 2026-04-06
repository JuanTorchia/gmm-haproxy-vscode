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
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { HaproxyParser } from './parser/parser';
import { HaproxyDocument } from './parser/ast';
import { ValidationProvider } from './validation/validator';
import { CompletionProvider } from './completion/completionProvider';
import { HoverProvider } from './hover/hoverProvider';
import { FormattingProvider } from './formatting/formatter';
import { SymbolsProvider } from './symbols/symbolsProvider';
import { DefinitionProvider } from './definition/definitionProvider';
import { CodeActionsProvider } from './codeactions/codeActionsProvider';
import { FoldingProvider } from './folding/foldingProvider';
import { VersionRegistry } from './registry/versionRegistry';
import { ServerSettings, DEFAULT_SETTINGS } from './settings';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments<TextDocument>(TextDocument);

const astCache = new Map<string, HaproxyDocument>();
const validationTimers = new Map<string, ReturnType<typeof setTimeout>>();

let settings: ServerSettings = { ...DEFAULT_SETTINGS };
let registry: VersionRegistry;
let hasConfigurationCapability = false;

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
    documents.all().forEach((doc) => scheduleValidation(doc));
  });
});

documents.onDidOpen((event) => {
  parseDocument(event.document);
  scheduleValidation(event.document);
});

documents.onDidChangeContent((event) => {
  parseDocument(event.document);
  scheduleValidation(event.document);
});

documents.onDidClose((event) => {
  astCache.delete(event.document.uri);
  const timer = validationTimers.get(event.document.uri);
  if (timer) clearTimeout(timer);
  validationTimers.delete(event.document.uri);
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
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

function parseDocument(doc: TextDocument): void {
  const parser = new HaproxyParser();
  const ast = parser.parse(doc.getText(), doc.uri);
  astCache.set(doc.uri, ast);
}

function scheduleValidation(doc: TextDocument): void {
  const existing = validationTimers.get(doc.uri);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    validationTimers.delete(doc.uri);
    validateDocument(doc);
  }, 400);

  validationTimers.set(doc.uri, timer);
}

function validateDocument(doc: TextDocument): void {
  if (!settings.validationEnabled) {
    void connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
    return;
  }
  const ast = astCache.get(doc.uri);
  if (!ast) return;
  const validator = new ValidationProvider(registry, settings.version);
  const diagnostics = validator.validate(ast);
  void connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

async function refreshSettings(): Promise<void> {
  if (!hasConfigurationCapability) return;
  try {
    const config: unknown = await connection.workspace.getConfiguration('haproxy');
    settings = {
      version: (config as Record<string, unknown>).version as string ?? DEFAULT_SETTINGS.version,
      validationEnabled: (config as Record<string, unknown>)['validate.enable'] as boolean ?? DEFAULT_SETTINGS.validationEnabled,
      completionEnabled: (config as Record<string, unknown>)['completion.enable'] as boolean ?? DEFAULT_SETTINGS.completionEnabled,
    };
  } catch {
    connection.console.error('Failed to retrieve HAProxy settings, using defaults.');
  }
}

documents.listen(connection);
connection.listen();
