import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { SectionType, SourceRange } from '../../parser/ast';
import { DirectiveDefinition, VersionRegistry } from '../../registry/versionRegistry';

/**
 * Everything a per-directive validation rule may read beyond the directive itself.
 *
 * Built once per directive by the validator after the directive has been
 * resolved against the registry. Rules only read it. Document-level concerns
 * (EOL warnings, cross-references) are deliberately absent: a rule sees one
 * directive, its section and the target version.
 */
export interface RuleContext {
  /** Directive name as resolved by the registry, e.g. `timeout connect`. Equal to `definition.name`. */
  readonly resolvedName: string;
  /** The registry definition the directive resolved to. */
  readonly definition: DirectiveDefinition;
  /** Type of the section the directive appears in. */
  readonly sectionType: SectionType;
  /** Effective mode of that section, inherited from `defaults` when not set locally. */
  readonly sectionMode: 'http' | 'tcp' | undefined;
  /** HAProxy version being validated against, as configured by the user. */
  readonly version: string;
  /** Registry for version comparisons and deprecation lookups. */
  readonly registry: VersionRegistry;
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
