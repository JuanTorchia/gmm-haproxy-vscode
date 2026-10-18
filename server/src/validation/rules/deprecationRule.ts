import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective } from '../../parser/ast';
import { RuleContext, ruleWarning } from './shared';

/** Replacement to suggest for a deprecated directive, keyed by resolved name. */
const MIGRATION_HINTS: Record<string, string> = {
  reqrep: "Use 'http-request replace-value' instead.",
  rsprep: "Use 'http-response replace-value' instead.",
};

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

  const hint = MIGRATION_HINTS[definition.name] ?? '';
  return [
    ruleWarning(
      directive.keyword.range,
      `'${definition.name}' is deprecated since HAProxy ${definition.deprecatedSinceVersion ?? '?'}. ${hint}`
    ),
  ];
}
