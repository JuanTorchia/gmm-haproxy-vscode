import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { HaproxyDocument, HaproxySection, HaproxyDirective } from '../parser/ast';
import { VersionRegistry, VERSION_EOL } from '../registry/versionRegistry';
import { validateCrossReferences, validateUnreferencedSymbols } from './validatorCrossRef';
import { RuleContext, ruleError } from './rules/shared';
import { deprecationRule } from './rules/deprecationRule';
import { wrongSectionRule } from './rules/sectionRule';
import { modeConflictRule } from './rules/modeRule';
import { actionKeywordRule } from './rules/actionRule';
import { timeoutValueRule } from './rules/timeoutRule';
import { portRangeRule } from './rules/portRule';

const MAX_DIAGNOSTICS = 100;

/** A per-directive validation strategy. */
type DirectiveRule = (directive: HaproxyDirective, context: RuleContext) => Diagnostic[];

/** Rules applied, in order, to every directive that resolved to a known definition. */
const DIRECTIVE_RULES: readonly DirectiveRule[] = [
  deprecationRule,
  wrongSectionRule,
  modeConflictRule,
  actionKeywordRule,
  timeoutValueRule,
  portRangeRule,
];

/**
 * Validates a parsed HAProxy document against a specific version's directive set.
 *
 * This class is the composition root: it resolves each directive against the
 * registry and hands the result to the rules in `rules/`. Two things stay here
 * on purpose rather than becoming rules:
 *  - Directive resolution (combined-name lookup and the since-version fallback
 *    for unknown directives) produces the definition every rule reads, so it
 *    cannot itself be a rule.
 *  - The end-of-life warning is about the whole document, not one directive,
 *    and does not fit the `(directive, context)` rule signature.
 */
export class ValidationProvider {
  constructor(
    private readonly registry: VersionRegistry,
    private readonly version: string
  ) {}

  validate(doc: HaproxyDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Warn once per document when validating against an end-of-life HAProxy version
    const eolDate = VERSION_EOL[this.registry.resolveVersion(this.version)];
    if (eolDate) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: `HAProxy ${this.registry.resolveVersion(this.version)} reached end of life (${eolDate}). Consider upgrading to 3.2 LTS or 3.4 LTS.`,
        source: 'haproxy',
      });
    }

    // Surface parse errors first
    for (const err of doc.parseErrors) {
      diagnostics.push(ruleError(err.range, err.message));
      if (diagnostics.length >= MAX_DIAGNOSTICS) return diagnostics;
    }

    for (const section of doc.sections) {
      this.validateSection(section, diagnostics);
      if (diagnostics.length >= MAX_DIAGNOSTICS) return diagnostics;
    }

    validateCrossReferences(doc, diagnostics);
    validateUnreferencedSymbols(doc, diagnostics);

    return diagnostics;
  }

  private validateSection(section: HaproxySection, out: Diagnostic[]): void {
    // use-server cross-reference: server must be defined in the same section
    if (section.type === 'backend' || section.type === 'listen') {
      const definedServers = new Set<string>();
      for (const dir of section.directives) {
        const kw = dir.keyword.value.toLowerCase();
        if (kw === 'server' || kw === 'server-template') {
          const a = dir.args[0];
          if (a) definedServers.add(a.value.toLowerCase());
        }
      }
      for (const dir of section.directives) {
        if (out.length >= MAX_DIAGNOSTICS) break;
        if (dir.keyword.value.toLowerCase() !== 'use-server') continue;
        const a = dir.args[0];
        if (a && !definedServers.has(a.value.toLowerCase())) {
          out.push(ruleError(a.range,
            `'${a.value}' is referenced by 'use-server' but no server named '${a.value}' is defined in this section.`));
        }
      }
    }

    for (const directive of section.directives) {
      this.validateDirective(directive, section, out);
      if (out.length >= MAX_DIAGNOSTICS) return;
    }
  }

  private validateDirective(
    directive: HaproxyDirective,
    section: HaproxySection,
    out: Diagnostic[]
  ): void {
    const kwName = directive.keyword.value.toLowerCase();
    const firstArgLower = directive.args[0]?.value.toLowerCase();
    const combinedName = firstArgLower ? `${kwName} ${firstArgLower}` : null;

    // Resolve directive: try combined name first (e.g. "tcp-request connection", "option httplog")
    const def =
      (combinedName ? this.registry.getDirective(combinedName, this.version) : undefined) ??
      this.registry.getDirective(kwName, this.version);

    if (!def) {
      const nearestVersion =
        (combinedName ? this.findSinceVersion(combinedName) : undefined) ??
        this.findSinceVersion(kwName);
      const displayName = combinedName ?? kwName;
      const msg = nearestVersion
        ? `Unknown directive '${displayName}'. It may be available since HAProxy ${nearestVersion}.`
        : `Unknown directive '${displayName}'.`;
      out.push(ruleError(directive.keyword.range, msg));
      return;
    }

    const context: RuleContext = {
      resolvedName: def.name,
      definition: def,
      sectionType: section.type,
      sectionMode: section.mode,
      version: this.version,
      registry: this.registry,
    };
    for (const rule of DIRECTIVE_RULES) {
      out.push(...rule(directive, context));
    }
  }

  private findSinceVersion(name: string): string | undefined {
    for (const v of this.registry.getKnownVersions()) {
      const def = this.registry.getDirective(name, v);
      if (def) return def.sinceVersion;
    }
    return undefined;
  }
}
