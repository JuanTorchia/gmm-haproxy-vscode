import { Location, Range } from 'vscode-languageserver/node';
import { Position } from 'vscode-languageserver/node';
import { HaproxyDocument, SourceRange } from '../parser/ast';

/** Keywords that reference a backend or listen section by name. */
const BACKEND_REF_KEYWORDS = new Set(['use_backend', 'default_backend']);

/**
 * Provides go-to-definition for backend/listen cross-references.
 *
 * When the cursor is on the name argument of `use_backend` or
 * `default_backend`, resolves to the section header of the target
 * backend or listen block.
 */
export class DefinitionProvider {
  provideDefinition(
    doc: HaproxyDocument,
    position: Position
  ): Location | null {
    const target = this.findBackendRef(doc, position);
    if (!target) return null;

    // Build a case-insensitive map of backend/listen section names → header range
    const defined = new Map<string, SourceRange>();
    for (const section of doc.sections) {
      if ((section.type === 'backend' || section.type === 'listen') && section.name) {
        defined.set(section.name.toLowerCase(), section.headerRange);
      }
    }

    const nameArg = target;
    const resolved = defined.get(nameArg.value.toLowerCase());
    if (!resolved) return null;

    return {
      uri: doc.uri,
      range: toRange(resolved),
    };
  }

  /**
   * If the cursor is on the name argument of a use_backend or
   * default_backend directive, return that argument token.
   */
  private findBackendRef(
    doc: HaproxyDocument,
    position: Position
  ): { value: string; range: SourceRange } | null {
    for (const section of doc.sections) {
      for (const directive of section.directives) {
        const kw = directive.keyword.value.toLowerCase();
        if (!BACKEND_REF_KEYWORDS.has(kw)) continue;

        const nameArg = directive.args[0];
        if (!nameArg) continue;

        // Skip dynamic backend selection (%[...], ${...})
        if (nameArg.value.startsWith('%') || nameArg.value.startsWith('$')) continue;

        if (containsPosition(nameArg.range, position)) {
          return nameArg;
        }
      }
    }
    return null;
  }
}

function containsPosition(range: SourceRange, pos: Position): boolean {
  if (pos.line < range.startLine || pos.line > range.endLine) return false;
  if (pos.line === range.startLine && pos.character < range.startCharacter) return false;
  if (pos.line === range.endLine && pos.character > range.endCharacter) return false;
  return true;
}

function toRange(r: SourceRange): Range {
  return {
    start: { line: r.startLine,  character: r.startCharacter },
    end:   { line: r.endLine,    character: r.endCharacter   },
  };
}
