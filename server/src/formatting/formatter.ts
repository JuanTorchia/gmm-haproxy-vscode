import { TextEdit, FormattingOptions, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const SECTION_KEYWORDS = new Set([
  'global', 'defaults', 'frontend', 'backend', 'listen',
  'userlist', 'peers', 'resolvers', 'mailers', 'ring',
  'log-forward', 'program', 'http-errors', 'cache',
]);

/**
 * Formats HAProxy config files:
 * - Section headers at column 0
 * - Directives indented with 4 spaces (or tabSize from options)
 * - Comments preserved in place
 * - Blank lines normalized (max 1 consecutive blank line between sections)
 */
export class FormattingProvider {
  format(doc: TextDocument, options: FormattingOptions): TextEdit[] {
    const text = doc.getText();
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    const formattedLines: string[] = [];

    let inSection = false;
    let consecutiveBlanks = 0;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();

      if (trimmed === '') {
        consecutiveBlanks++;
        if (consecutiveBlanks <= 1) {
          formattedLines.push('');
        }
        continue;
      }

      consecutiveBlanks = 0;

      // Preserve comments, but fix indentation
      if (trimmed.startsWith('#')) {
        formattedLines.push(inSection ? `${indent}${trimmed}` : trimmed);
        continue;
      }

      const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';

      if (SECTION_KEYWORDS.has(firstWord)) {
        inSection = true;
        formattedLines.push(trimmed); // section headers at column 0
      } else if (inSection) {
        formattedLines.push(`${indent}${trimmed}`);
      } else {
        formattedLines.push(trimmed);
      }
    }

    // Remove trailing blank lines
    while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
      formattedLines.pop();
    }

    const newText = formattedLines.join('\n') + '\n';

    if (newText === text) return [];

    const fullRange: Range = {
      start: { line: 0, character: 0 },
      end: { line: doc.lineCount, character: 0 },
    };

    return [TextEdit.replace(fullRange, newText)];
  }
}
