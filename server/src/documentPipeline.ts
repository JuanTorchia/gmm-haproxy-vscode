import { Connection } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { HaproxyParser } from './parser/parser';
import { ValidationProvider } from './validation/validator';
import { VersionRegistry } from './registry/versionRegistry';
import { ServerSettings } from './settings';
import { MAX_VALIDATION_LINE_COUNT, shouldSkipValidationForLineCount } from './documentSizePolicy';
import { DocumentState } from './documentState';
import { hasConfigSections } from './configPresence';

const VALIDATION_DEBOUNCE_MS = 400;

/** Live server context read by the pipeline at the moment each step runs. */
export interface PipelineContext {
  readonly settings: ServerSettings;
  readonly registry: VersionRegistry;
}

/**
 * Document parse + debounced validation pipeline, including oversized-document gating.
 * Publishes diagnostics through the LSP connection; owns no LSP handler registration.
 */
export class DocumentPipeline {
  /**
   * @param connection LSP connection used to publish diagnostics and notifications.
   * @param documentState Per-document AST cache, timers and size tracking.
   * @param getContext Returns the current settings and version registry.
   */
  constructor(
    private readonly connection: Connection,
    private readonly documentState: DocumentState,
    private readonly getContext: () => PipelineContext
  ) {}

  /**
   * Parse a document into the AST cache and schedule its validation.
   *
   * @param doc Opened or changed document.
   * @returns Nothing.
   */
  refresh(doc: TextDocument): void {
    if (this.handleOversizedDocument(doc)) return;
    this.parseDocument(doc);
    this.scheduleValidation(doc);
  }

  /**
   * Schedule validation of an already-parsed document (e.g. after a settings change).
   *
   * @param doc Open document.
   * @returns Nothing.
   */
  revalidate(doc: TextDocument): void {
    if (this.handleOversizedDocument(doc)) return;
    this.scheduleValidation(doc);
  }

  private parseDocument(doc: TextDocument): void {
    if (isOversizedDocument(doc)) {
      this.documentState.astCache.delete(doc.uri);
      return;
    }
    const parser = new HaproxyParser();
    const ast = parser.parse(doc.getText(), doc.uri);
    this.documentState.astCache.set(doc.uri, ast);
  }

  private scheduleValidation(doc: TextDocument): void {
    if (isOversizedDocument(doc)) {
      this.documentState.clearPendingValidation(doc.uri);
      return;
    }
    this.documentState.scheduleValidation(doc.uri, VALIDATION_DEBOUNCE_MS, () => this.validateDocument(doc));
  }

  private validateDocument(doc: TextDocument): void {
    if (this.handleOversizedDocument(doc)) return;
    const { settings, registry } = this.getContext();
    if (!settings.validationEnabled) {
      this.clearDiagnostics(doc.uri);
      return;
    }
    const ast = this.documentState.astCache.get(doc.uri);
    if (!ast) return;
    if (!hasConfigSections(ast, doc.getText())) {
      this.clearDiagnostics(doc.uri);
      return;
    }
    const validator = new ValidationProvider(registry, settings.version);
    const diagnostics = validator.validate(ast);
    void this.connection.sendDiagnostics({ uri: doc.uri, diagnostics });
  }

  private handleOversizedDocument(doc: TextDocument): boolean {
    const { oversizedDocuments } = this.documentState;
    if (!isOversizedDocument(doc)) {
      oversizedDocuments.markAllowed(doc.uri);
      return false;
    }

    this.documentState.astCache.delete(doc.uri);
    this.documentState.clearPendingValidation(doc.uri);
    this.clearDiagnostics(doc.uri);

    if (oversizedDocuments.markSkipped(doc.uri)) {
      void this.connection.window.showInformationMessage(
        `HAProxy diagnostics skipped for this file because it has ${doc.lineCount} lines, above the ${MAX_VALIDATION_LINE_COUNT} line limit. Syntax highlighting remains active.`
      );
    }

    return true;
  }

  private clearDiagnostics(uri: string): void {
    void this.connection.sendDiagnostics({ uri, diagnostics: [] });
  }
}

function isOversizedDocument(doc: TextDocument): boolean {
  return shouldSkipValidationForLineCount(doc.lineCount);
}
