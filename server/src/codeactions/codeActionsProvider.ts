import { CodeAction, CodeActionKind, Diagnostic, Range, TextEdit, WorkspaceEdit } from 'vscode-languageserver/node';
import { HaproxyDocument } from '../parser/ast';

/**
 * Directives where a direct text substitution is safe.
 * key = deprecated directive name (lowercase), value = replacement text.
 */
export const SAFE_REPLACEMENTS: Record<string, string> = {
  'option httpclose':   'option http-server-close',
  'option forceclose':  'option http-server-close',
};

/**
 * Diagnostic message substrings that identify a deprecation warning
 * where we can offer a safe quick-fix.
 */
const DEPRECATED_MARKER = 'is deprecated since HAProxy';

/**
 * Provides "Quick Fix" code actions for deprecated HAProxy directives.
 *
 * Only offers fixes where the replacement is a safe 1:1 keyword substitution.
 * Complex migrations (reqrep → http-request replace-value) are intentionally
 * excluded: the migration hint in the diagnostic message is sufficient guidance.
 */
export class CodeActionsProvider {
  provideCodeActions(
    doc: HaproxyDocument,
    _range: Range,
    diagnostics: Diagnostic[]
  ): CodeAction[] {
    const actions: CodeAction[] = [];

    for (const diag of diagnostics) {
      if (typeof diag.message !== 'string') continue;
      if (!diag.message.includes(DEPRECATED_MARKER)) continue;

      // Extract the directive name from the message: "'<name>' is deprecated..."
      const match = /^'([^']+)' is deprecated/.exec(diag.message);
      if (!match) continue;

      const directiveName = match[1].toLowerCase();
      const replacement = SAFE_REPLACEMENTS[directiveName];
      if (!replacement) continue;

      // Find the directive in the AST to get its full line range for the edit
      const directiveRange = this.findDirectiveRange(doc, diag.range, directiveName);
      if (!directiveRange) continue;

      const edit: WorkspaceEdit = {
        changes: {
          [doc.uri]: [
            TextEdit.replace(directiveRange, replacement),
          ],
        },
      };

      actions.push({
        title: `Replace '${directiveName}' with '${replacement}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit,
        isPreferred: true,
      });
    }

    return actions;
  }

  /**
   * Finds the exact keyword range of a directive that starts at the given
   * diagnostic range, so the TextEdit replaces only the keyword tokens.
   */
  private findDirectiveRange(
    doc: HaproxyDocument,
    diagRange: Range,
    directiveName: string
  ): Range | null {
    const targetLine = diagRange.start.line;

    for (const section of doc.sections) {
      for (const directive of section.directives) {
        if (directive.keyword.range.startLine !== targetLine) continue;

        const kw = directive.keyword.value.toLowerCase();
        const firstArg = directive.args[0]?.value.toLowerCase();
        const combined = firstArg ? `${kw} ${firstArg}` : kw;

        if (combined === directiveName || kw === directiveName) {
          // Range: from start of keyword to end of first arg (if compound), or end of keyword
          const endRange = (combined === directiveName && firstArg)
            ? directive.args[0].range
            : directive.keyword.range;

          return {
            start: {
              line: directive.keyword.range.startLine,
              character: directive.keyword.range.startCharacter,
            },
            end: {
              line: endRange.endLine,
              character: endRange.endCharacter,
            },
          };
        }
      }
    }

    return null;
  }
}
