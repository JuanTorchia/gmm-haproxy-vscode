import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective } from '../../parser/ast';
import { RuleContext, ruleError } from './shared';

/**
 * Reports an HTTP-only directive in a TCP-mode section, or the reverse.
 *
 * A section whose mode could not be determined is never reported.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns An error when the directive conflicts with the section mode; empty otherwise.
 */
export function modeConflictRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  const { definition, sectionMode } = context;
  const out: Diagnostic[] = [];
  if (definition.httpOnly && sectionMode === 'tcp') {
    out.push(ruleError(directive.keyword.range, `'${definition.name}' requires HTTP mode but this section is in TCP mode.`));
  }
  if (definition.tcpOnly && sectionMode === 'http') {
    out.push(ruleError(directive.keyword.range, `'${definition.name}' requires TCP mode but this section is in HTTP mode.`));
  }
  return out;
}
