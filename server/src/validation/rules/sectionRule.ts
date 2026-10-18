import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective } from '../../parser/ast';
import { RuleContext, ruleError } from './shared';

/**
 * Reports a directive used in a section type that does not accept it.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns A single error listing the valid sections; empty when the section is valid.
 */
export function wrongSectionRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  const { definition, sectionType } = context;
  if (definition.sections.includes(sectionType)) return [];

  return [
    ruleError(
      directive.keyword.range,
      `'${definition.name}' is not valid in a '${sectionType}' section. Valid sections: ${definition.sections.join(', ')}.`
    ),
  ];
}
