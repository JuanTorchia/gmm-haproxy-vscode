import { Location } from 'vscode-languageserver/node';
import { Position } from 'vscode-languageserver/node';
import { HaproxyDocument, SourceRange } from '../parser/ast';
import { resolveSymbolAtPosition, collectOccurrences } from '../shared/symbolResolver';

/**
 * Provides go-to-definition for all named cross-references:
 * backend, defaults, ACL, server, cache, userlist, resolvers, and peers names.
 *
 * When the cursor is on any reference token, jumps to its definition.
 * When the cursor is already on the definition, the definition itself is returned
 * (VSCode will show references inline in that case via the peek UI).
 */
export class DefinitionProvider {
  provideDefinition(doc: HaproxyDocument, position: Position): Location | null {
    const symbol = resolveSymbolAtPosition(doc, position);
    if (!symbol) return null;

    const definition = collectOccurrences(doc, symbol).find(o => o.isDefinition);
    return definition ? { uri: doc.uri, range: toRange(definition.range) } : null;
  }
}

function toRange(r: SourceRange): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end:   { line: r.endLine,   character: r.endCharacter   },
  };
}
