import { HaproxyDocument } from './parser/ast';

const KEY_VALUE_SETTING = /^[^\s=:]+\s*[=:]/;

/**
 * Determines if a document contains valid HAProxy sections (vs. other config syntax).
 * HAProxy section headers never end with ';' or '{', while nginx statements do.
 * For example, `listen 80;` (ends with `;`) is nginx syntax, not HAProxy.
 * A keyword followed by `=` or `:` is a `key = value` setting (php-fpm, dovecot, ini).
 *
 * @param ast Parsed document.
 * @param text Raw document text.
 * @returns `true` when the document has at least one section with `type !== 'unknown'`
 *          whose header line does not end with ';' or '{' (after removing comments)
 *          and whose keyword is not followed by `=` or `:`.
 */
export function hasConfigSections(ast: HaproxyDocument, text: string): boolean {
  const lines = text.split(/\r?\n/);

  return ast.sections.some((section) => {
    if (section.type === 'unknown') return false;

    const headerLine = lines[section.headerRange.startLine];
    if (!headerLine) return false;

    const header = headerLine.split('#')[0]?.trim() ?? '';
    return !header.endsWith(';') && !header.endsWith('{') && !KEY_VALUE_SETTING.test(header);
  });
}
