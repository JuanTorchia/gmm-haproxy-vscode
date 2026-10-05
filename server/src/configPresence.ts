import { HaproxyDocument } from './parser/ast';

/**
 * Determines if a document contains valid HAProxy sections (vs. other config syntax).
 * HAProxy section headers never end with ';' or '{', while nginx statements do.
 * For example, `listen 80;` (ends with `;`) is nginx syntax, not HAProxy.
 *
 * @param ast Parsed document.
 * @param text Raw document text.
 * @returns `true` when the document has at least one section with `type !== 'unknown'`
 *          whose header line does not end with ';' or '{' (after removing comments).
 */
export function hasConfigSections(ast: HaproxyDocument, text: string): boolean {
  const lines = text.split(/\r?\n/);

  return ast.sections.some((section) => {
    if (section.type === 'unknown') return false;

    // Get the header line for this section
    const headerLineIdx = section.headerRange.startLine;
    const headerLine = lines[headerLineIdx];
    if (!headerLine) return false;

    // Remove comments and trim
    const headerWithoutComment = headerLine.split('#')[0]?.trim() ?? '';

    // HAProxy section headers never end with ';' or '{'
    // (nginx statements like `listen 80;` or `server {` do)
    if (headerWithoutComment.endsWith(';') || headerWithoutComment.endsWith('{')) {
      return false;
    }

    return true;
  });
}
