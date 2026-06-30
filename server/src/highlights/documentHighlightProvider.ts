import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver/node';
import { Position } from 'vscode-languageserver/node';
import { HaproxyDocument, SourceRange } from '../parser/ast';
import { resolveSymbolAtPosition, collectOccurrences } from '../shared/symbolResolver';

/**
 * Provides document highlights for backend/listen names and named defaults sections.
 *
 * When the cursor lands on a symbol name, VSCode marks all other occurrences in
 * the editor: Write (green) for the definition, Read (blue) for references.
 */
export class DocumentHighlightProvider {
  provideHighlights(doc: HaproxyDocument, position: Position): DocumentHighlight[] {
    const symbol = resolveSymbolAtPosition(doc, position);
    if (!symbol) return [];

    return collectOccurrences(doc, symbol).map(({ range, isDefinition }) => ({
      range: toRange(range),
      kind: isDefinition ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
    }));
  }
}

function toRange(r: SourceRange): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end:   { line: r.endLine,   character: r.endCharacter   },
  };
}
