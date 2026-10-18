import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective } from '../../parser/ast';
import { RuleContext, ruleWarning } from './shared';

/**
 * Warns when a directive is deprecated in the selected HAProxy version.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns A single warning with a migration hint when deprecated; empty otherwise.
 */
export function deprecationRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  const { definition, registry, version } = context;
  if (!registry.isDeprecated(definition.name, version)) return [];

  const message = `'${definition.name}' is deprecated since HAProxy ${definition.deprecatedSinceVersion ?? '?'}.`;
  return [ruleWarning(directive.keyword.range, definition.migration ? `${message} ${definition.migration}` : message)];
}
