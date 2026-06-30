import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { HaproxyDocument, HaproxySection, HaproxyDirective, SourceRange } from '../parser/ast';
import { VersionRegistry } from '../registry/versionRegistry';
import { ACTIONS, ActionRulesets } from '../data/actions';
import { validateCrossReferences, validateUnreferencedSymbols } from './validatorCrossRef';

const MAX_DIAGNOSTICS = 100;

/**
 * Maps a fully-resolved directive name (e.g. "tcp-request connection") to the
 * ActionRulesets key and the arg index that contains the action sub-keyword.
 */
const ACTION_DIRECTIVE_RULESETS: Record<string, { key: keyof ActionRulesets; actionArgIdx: number }> = {
  'http-request':            { key: 'httpReq', actionArgIdx: 0 },
  'http-response':           { key: 'httpRes', actionArgIdx: 0 },
  'http-after-response':     { key: 'httpAft', actionArgIdx: 0 },
  'tcp-request connection':  { key: 'tcpRqCon', actionArgIdx: 1 },
  'tcp-request session':     { key: 'tcpRqSes', actionArgIdx: 1 },
  'tcp-request content':     { key: 'tcpRqCnt', actionArgIdx: 1 },
  'tcp-response content':    { key: 'tcpRsCnt', actionArgIdx: 1 },
};

/**
 * Validates a parsed HAProxy document against a specific version's directive set.
 */
export class ValidationProvider {
  constructor(
    private readonly registry: VersionRegistry,
    private readonly version: string
  ) {}

  validate(doc: HaproxyDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Surface parse errors first
    for (const err of doc.parseErrors) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: toRange(err.range),
        message: err.message,
        source: 'haproxy',
      });
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
          out.push(error(toRange(a.range),
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
      out.push(error(toRange(directive.range), msg));
      return;
    }

    // Check if directive is deprecated
    if (this.registry.isDeprecated(def.name, this.version)) {
      out.push(
        warning(
          toRange(directive.keyword.range),
          `'${def.name}' is deprecated since HAProxy ${def.deprecatedSinceVersion ?? '?'}. ${migrationHint(def.name)}`
        )
      );
    }

    // Check section validity
    if (!def.sections.includes(section.type)) {
      out.push(
        error(
          toRange(directive.keyword.range),
          `'${def.name}' is not valid in a '${section.type}' section. Valid sections: ${def.sections.join(', ')}.`
        )
      );
    }

    // Check mode compatibility
    if (def.httpOnly && section.mode === 'tcp') {
      out.push(
        error(
          toRange(directive.keyword.range),
          `'${def.name}' requires HTTP mode but this section is in TCP mode.`
        )
      );
    }
    if (def.tcpOnly && section.mode === 'http') {
      out.push(
        error(
          toRange(directive.keyword.range),
          `'${def.name}' requires TCP mode but this section is in HTTP mode.`
        )
      );
    }

    // Validate action sub-keyword (e.g. http-request deny, tcp-request connection accept)
    this.validateAction(directive, def.name, out);
  }

  private validateAction(directive: HaproxyDirective, resolvedName: string, out: Diagnostic[]): void {
    const mapping = ACTION_DIRECTIVE_RULESETS[resolvedName];
    if (!mapping) return;

    const actionArg = directive.args[mapping.actionArgIdx];
    if (!actionArg) return; // no action provided — incomplete line, parser will catch it

    const actionName = stripParens(actionArg.value.toLowerCase());
    const action = ACTIONS.find((a) => a.name === actionName);

    if (!action) {
      out.push(error(
        toRange(actionArg.range),
        `Unknown ${resolvedName} action '${actionArg.value}'.`
      ));
      return;
    }

    if (!action.rulesets[mapping.key]) {
      out.push(error(
        toRange(actionArg.range),
        `'${actionName}' is not a valid action for '${resolvedName}'.`
      ));
      return;
    }

    if (action.deprecated && this.registry.compareVersions(this.version, action.deprecated) >= 0) {
      out.push(warning(
        toRange(actionArg.range),
        `'${actionName}' is deprecated since HAProxy ${action.deprecated}.`
      ));
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

/** Strip parenthesised arguments from an action/fetch token: set-var(x) → set-var */
function stripParens(raw: string): string {
  const idx = raw.indexOf('(');
  return idx === -1 ? raw : raw.slice(0, idx);
}

const MIGRATION_HINTS: Record<string, string> = {
  reqrep: "Use 'http-request replace-value' instead.",
  rsprep: "Use 'http-response replace-value' instead.",
};

function migrationHint(name: string): string {
  return MIGRATION_HINTS[name] ?? '';
}

function toRange(r: SourceRange): Range {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end: { line: r.endLine, character: r.endCharacter },
  };
}

function error(range: Range, message: string): Diagnostic {
  return { severity: DiagnosticSeverity.Error, range, message, source: 'haproxy' };
}

function warning(range: Range, message: string): Diagnostic {
  return { severity: DiagnosticSeverity.Warning, range, message, source: 'haproxy' };
}
