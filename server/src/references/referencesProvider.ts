import { Location } from 'vscode-languageserver/node';
import { Position } from 'vscode-languageserver/node';
import { HaproxyDocument, SourceRange } from '../parser/ast';
import { resolveSymbolAtPosition, collectOccurrences } from '../shared/symbolResolver';

/**
 * Provides "Find All References" for backend/listen names and named defaults sections.
 */
export class ReferencesProvider {
  provideReferences(
    doc: HaproxyDocument,
    position: Position,
    includeDeclaration: boolean
  ): Location[] {
    const symbol = resolveSymbolAtPosition(doc, position);
    if (!symbol) return [];

    return collectOccurrences(doc, symbol)
      .filter(({ isDefinition }) => includeDeclaration || !isDefinition)
      .map(({ range }) => ({ uri: doc.uri, range: toRange(range) }));
  }
}

function toRange(r: SourceRange): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end:   { line: r.endLine,   character: r.endCharacter   },
  };
}
