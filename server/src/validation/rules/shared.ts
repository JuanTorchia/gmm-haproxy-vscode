import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { SourceRange } from '../../parser/ast';

/** Context a validation rule needs beyond the directive itself. */
export interface RuleContext {
  /** Directive name as resolved by the registry, e.g. `timeout connect`. */
  readonly resolvedName: string;
}

/**
 * Converts a parser source range into an LSP range.
 *
 * @param r - Range carried by an AST node.
 * @returns The equivalent LSP range.
 */
export function toRange(r: SourceRange): Range {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end: { line: r.endLine, character: r.endCharacter },
  };
}

/**
 * Builds an error diagnostic — the config will not load.
 *
 * @param range - Source range to underline.
 * @param message - What is wrong and how to fix it.
 * @returns The diagnostic.
 */
export function ruleError(range: SourceRange, message: string): Diagnostic {
  return { severity: DiagnosticSeverity.Error, range: toRange(range), message, source: 'haproxy' };
}

/**
 * Builds a warning diagnostic — the config loads but may behave unexpectedly.
 *
 * @param range - Source range to underline.
 * @param message - What is wrong and how to fix it.
 * @returns The diagnostic.
 */
export function ruleWarning(range: SourceRange, message: string): Diagnostic {
  return { severity: DiagnosticSeverity.Warning, range: toRange(range), message, source: 'haproxy' };
}
