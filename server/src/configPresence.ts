import { HaproxyDocument } from './parser/ast';

/**
 * HAProxy rejects directives outside a known section, so a document without one
 * is not a configuration we can meaningfully validate. The parser records any
 * other column-0 line (e.g. nginx `server {`) as an `unknown` section.
 * @param ast Parsed document.
 * @returns `true` when the document declares at least one HAProxy section.
 */
export function hasConfigSections(ast: HaproxyDocument): boolean {
  return ast.sections.some((section) => section.type !== 'unknown');
}
