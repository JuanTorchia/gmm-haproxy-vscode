import { DocumentSymbol, SymbolKind, Range } from 'vscode-languageserver/node';
import { HaproxyDocument, HaproxySection, SectionType, SourceRange } from '../parser/ast';

/**
 * Maps each HAProxy section type to the most appropriate LSP SymbolKind.
 * Chosen so the outline panel icons look meaningful at a glance.
 */
const SECTION_SYMBOL_KIND: Record<SectionType, SymbolKind> = {
  global:       SymbolKind.Namespace,
  defaults:     SymbolKind.Module,
  frontend:     SymbolKind.Interface,
  backend:      SymbolKind.Class,
  listen:       SymbolKind.Function,
  userlist:     SymbolKind.Object,
  peers:        SymbolKind.Module,
  resolvers:    SymbolKind.Module,
  mailers:      SymbolKind.Module,
  ring:         SymbolKind.Module,
  'log-forward':SymbolKind.Module,
  program:      SymbolKind.Module,
  'http-errors':SymbolKind.Module,
  cache:        SymbolKind.Module,
  unknown:      SymbolKind.Module,
};

/**
 * Returns document symbols (one per section) for the outline panel,
 * breadcrumbs, and go-to-symbol navigation.
 */
export class SymbolsProvider {
  provideSymbols(doc: HaproxyDocument): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];

    for (let i = 0; i < doc.sections.length; i++) {
      const section = doc.sections[i]!;
      const nextSection = doc.sections[i + 1];

      const fullRange = this.sectionRange(section, nextSection);
      const selectionRange = toRange(section.headerRange);

      const label = section.name
        ? `${section.type} ${section.name}`
        : section.type;

      const symbol: DocumentSymbol = {
        name: label,
        detail: '',
        kind: SECTION_SYMBOL_KIND[section.type] ?? SymbolKind.Module,
        range: fullRange,
        selectionRange,
        children: this.sectionChildren(section),
      };

      symbols.push(symbol);
    }

    return symbols;
  }

  /**
   * Computes the full range of a section: from its header line to
   * the line before the next section starts, or to its last directive.
   */
  private sectionRange(section: HaproxySection, nextSection: HaproxySection | undefined): Range {
    const startLine = section.headerRange.startLine;

    if (nextSection) {
      // End just before the next section header
      const endLine = Math.max(startLine, nextSection.headerRange.startLine - 1);
      return {
        start: { line: startLine, character: 0 },
        end:   { line: endLine, character: Number.MAX_SAFE_INTEGER },
      };
    }

    // Last section: end at last directive or at the header itself
    if (section.directives.length > 0) {
      const last = section.directives[section.directives.length - 1]!;
      return {
        start: { line: startLine, character: 0 },
        end:   { line: last.range.endLine, character: last.range.endCharacter },
      };
    }

    return toRange(section.headerRange);
  }

  /**
   * Returns child symbols for a section.
   * Surfaces key structural directives: bind, server, default-server, acl.
   */
  private sectionChildren(section: HaproxySection): DocumentSymbol[] {
    const children: DocumentSymbol[] = [];

    for (const directive of section.directives) {
      const kw = directive.keyword.value.toLowerCase();

      if (kw === 'bind') {
        const addr = directive.args[0]?.value ?? '';
        children.push({
          name: `bind ${addr}`,
          detail: '',
          kind: SymbolKind.Event,
          range: toRange(directive.range),
          selectionRange: toRange(directive.keyword.range),
        });
      } else if (kw === 'server' || kw === 'default-server') {
        const name = directive.args[0]?.value ?? '';
        const addr = directive.args[1]?.value ?? '';
        children.push({
          name: name ? `${kw} ${name}` : kw,
          detail: addr,
          kind: SymbolKind.Field,
          range: toRange(directive.range),
          selectionRange: toRange(directive.keyword.range),
        });
      } else if (kw === 'acl') {
        const name = directive.args[0]?.value ?? '';
        children.push({
          name: `acl ${name}`,
          detail: '',
          kind: SymbolKind.Constant,
          range: toRange(directive.range),
          selectionRange: toRange(directive.keyword.range),
        });
      }
    }

    return children;
  }
}

function toRange(r: SourceRange): Range {
  return {
    start: { line: r.startLine,  character: r.startCharacter },
    end:   { line: r.endLine,    character: r.endCharacter   },
  };
}
