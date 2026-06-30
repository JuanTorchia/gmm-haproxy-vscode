import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { HaproxyDocument, SourceRange } from '../parser/ast';

const MAX_DIAGNOSTICS = 100;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function toRange(r: SourceRange): Range {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end: { line: r.endLine, character: r.endCharacter },
  };
}

function warning(range: Range, message: string): Diagnostic {
  return { severity: DiagnosticSeverity.Warning, range, message, source: 'haproxy' };
}

function info(range: Range, message: string): Diagnostic {
  return { severity: DiagnosticSeverity.Information, range, message, source: 'haproxy' };
}

// ─── Sub-functions for validateUnreferencedSymbols ───────────────────────────

function checkUnreferencedBackends(doc: HaproxyDocument, out: Diagnostic[]): void {
  const referencedBackends = new Set<string>();
  for (const section of doc.sections) {
    for (const dir of section.directives) {
      const kw = dir.keyword.value.toLowerCase();
      if (kw === 'use_backend' || kw === 'default_backend') {
        const a = dir.args[0];
        if (a && !a.value.startsWith('%') && !a.value.startsWith('$')) {
          referencedBackends.add(a.value.toLowerCase());
        }
      }
    }
  }
  for (const section of doc.sections) {
    if (out.length >= MAX_DIAGNOSTICS) return;
    if (section.type === 'backend' && section.name && section.nameToken &&
        !referencedBackends.has(section.name.toLowerCase())) {
      // SPOE backends are referenced from an external agent config file — skip them.
      if (section.name.toLowerCase().includes('spoe')) continue;
      out.push(info(toRange(section.nameToken.range),
        `Backend '${section.name}' is never referenced by use_backend or default_backend in this file.`));
    }
  }
}

function checkUnreferencedDefaults(doc: HaproxyDocument, out: Diagnostic[]): void {
  const referencedDefaults = new Set<string>();
  for (const section of doc.sections) {
    if (section.from) referencedDefaults.add(section.from.value.toLowerCase());
  }
  for (const section of doc.sections) {
    if (out.length >= MAX_DIAGNOSTICS) return;
    if (section.type === 'defaults' && section.name && section.nameToken &&
        !referencedDefaults.has(section.name.toLowerCase())) {
      out.push(info(toRange(section.nameToken.range),
        `Defaults profile '${section.name}' is never referenced by a 'from' clause in this file.`));
    }
  }
}

function checkUnusedAcls(doc: HaproxyDocument, out: Diagnostic[]): void {
  for (const section of doc.sections) {
    if (out.length >= MAX_DIAGNOSTICS) return;
    const defined = new Map<string, SourceRange>();
    const used    = new Set<string>();

    for (const dir of section.directives) {
      const kw = dir.keyword.value.toLowerCase();
      if (kw === 'acl' && dir.args[0]) {
        defined.set(dir.args[0].value.toLowerCase(), dir.args[0].range);
      }
      const ifIdx = dir.args.findIndex(a => { const v = a.value.toLowerCase(); return v === 'if' || v === 'unless'; });
      if (ifIdx !== -1) {
        for (const a of dir.args.slice(ifIdx + 1)) {
          const name = a.value.startsWith('!') ? a.value.slice(1) : a.value;
          if (/^[\w][\w\-.]*$/.test(name)) used.add(name.toLowerCase());
        }
      }
    }

    for (const [name, range] of defined) {
      if (out.length >= MAX_DIAGNOSTICS) return;
      if (!used.has(name)) {
        out.push(info(toRange(range),
          `ACL '${name}' is defined but never used in an if/unless condition in this section.`));
      }
    }
  }
}

// ─── Exported functions ───────────────────────────────────────────────────────

export function validateUnreferencedSymbols(doc: HaproxyDocument, out: Diagnostic[]): void {
  if (out.length >= MAX_DIAGNOSTICS) return;
  checkUnreferencedBackends(doc, out);
  checkUnreferencedDefaults(doc, out);
  checkUnusedAcls(doc, out);
}

export function validateCrossReferences(doc: HaproxyDocument, out: Diagnostic[]): void {
  const definedBackends = new Set<string>();
  const definedDefaults = new Set<string>();
  const definedCaches   = new Set<string>();

  for (const section of doc.sections) {
    if ((section.type === 'backend' || section.type === 'listen') && section.name) {
      definedBackends.add(section.name.toLowerCase());
    }
    if (section.type === 'defaults' && section.name) {
      definedDefaults.add(section.name.toLowerCase());
    }
    if (section.type === 'cache' && section.name) {
      definedCaches.add(section.name.toLowerCase());
    }
  }

  for (const section of doc.sections) {
    if (section.from && out.length < MAX_DIAGNOSTICS) {
      if (!definedDefaults.has(section.from.value.toLowerCase())) {
        out.push(warning(toRange(section.from.range),
          `'${section.from.value}' is referenced via 'from' but no defaults section named '${section.from.value}' is defined in this file.`));
      }
    }

    for (const directive of section.directives) {
      if (out.length >= MAX_DIAGNOSTICS) return;
      const kw = directive.keyword.value.toLowerCase();

      if (kw === 'use_backend' || kw === 'default_backend') {
        const a = directive.args[0];
        if (a && !a.value.startsWith('%') && !a.value.startsWith('$') &&
            !definedBackends.has(a.value.toLowerCase())) {
          out.push(warning(toRange(a.range),
            `'${a.value}' is referenced by '${kw}' but no backend or listen section named '${a.value}' is defined in this file.`));
        }
      }

      if (kw === 'http-request' && directive.args[0]?.value.toLowerCase() === 'cache-use') {
        const a = directive.args[1];
        if (a && !definedCaches.has(a.value.toLowerCase())) {
          out.push(warning(toRange(a.range),
            `Cache section '${a.value}' is not defined in this file.`));
        }
      }

      if (kw === 'http-response' && directive.args[0]?.value.toLowerCase() === 'cache-store') {
        const a = directive.args[1];
        if (a && !definedCaches.has(a.value.toLowerCase())) {
          out.push(warning(toRange(a.range),
            `Cache section '${a.value}' is not defined in this file.`));
        }
      }
    }
  }
}
