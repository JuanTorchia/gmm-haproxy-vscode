/** Minimal mock of vscode-languageserver/node for unit tests. */

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export enum CompletionItemKind {
  Keyword = 14,
  Property = 10,
  Value = 12,
  Reference = 18,
  Function = 3,
  Constant = 21,
}

export enum CompletionItemTag {
  Deprecated = 1,
}

export enum MarkupKind {
  Markdown = 'markdown',
  PlainText = 'plaintext',
}

export interface Range {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface Diagnostic {
  severity?: DiagnosticSeverity;
  range: Range;
  message: string;
  source?: string;
}

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: unknown;
  tags?: CompletionItemTag[];
}

export interface Hover {
  contents: unknown;
  range?: Range;
}

export interface Position {
  line: number;
  character: number;
}

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export const TextEdit = {
  replace: (range: Range, newText: string): TextEdit => ({ range, newText }),
  insert: (position: { line: number; character: number }, newText: string): TextEdit => ({
    range: { start: position, end: position },
    newText,
  }),
};

export const FoldingRangeKind = {
  Comment: 'comment',
  Imports: 'imports',
  Region: 'region',
};

export const CodeActionKind = {
  QuickFix: 'quickfix',
  Refactor: 'refactor',
  Source: 'source',
};

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
}

export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  edit?: WorkspaceEdit;
  isPreferred?: boolean;
}

export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
}

// Stub unused exports to satisfy imports
export const createConnection = (): unknown => ({});
export const TextDocuments = class {};
export const ProposedFeatures = { all: {} };
export const TextDocumentSyncKind = { Incremental: 2 };
export const DidChangeConfigurationNotification = { type: {} };
