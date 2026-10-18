import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective, SectionType } from '../../parser/ast';
import { RuleContext, ruleError } from './shared';

/**
 * Sections whose directives the arity annotations describe. Special sections
 * reuse some names with a different shape — a `server` in `peers` may omit its
 * address for the local peer — so arity is not checked there.
 */
const ARITY_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'global',
  'defaults',
  'frontend',
  'listen',
  'backend',
]);

/**
 * Validates the argument count of directives annotated with `minArgs` / `maxArgs`.
 *
 * Counts the parsed arguments, so continuation lines are already joined. A
 * combined name such as `stats uri` consumes its second word from the
 * arguments, which is subtracted. Any argument with an environment reference
 * may expand to zero or several words, so such lines are skipped rather than
 * guessed at.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns A single error when too few or too many arguments are given; empty otherwise.
 */
export function arityRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  const { definition, sectionType } = context;
  const { minArgs, maxArgs } = definition;
  if (minArgs === undefined && maxArgs === undefined) return [];
  if (!ARITY_SECTIONS.has(sectionType)) return [];
  if (directive.args.some((a) => a.value.includes('$'))) return [];

  const nameWordsInArgs = definition.name.split(' ').length - 1;
  const args = directive.args.slice(nameWordsInArgs);
  const usage = `Usage: ${definition.signature}`;

  if (minArgs !== undefined && args.length < minArgs) {
    const required = definition.requiredArgs ?? [];
    const missing = required.slice(args.length);
    const message = required.length > 0
      ? `'${definition.name}' requires ${joinAnd(required)}; missing: ${joinAnd(missing)}. ${usage}`
      : `'${definition.name}' requires at least ${plural(minArgs)} but got ${args.length}. ${usage}`;
    return [ruleError(directive.keyword.range, message)];
  }

  const firstExtra = maxArgs === undefined ? undefined : args[maxArgs];
  const last = args[args.length - 1];
  if (maxArgs !== undefined && firstExtra && last) {
    const bound = minArgs === maxArgs ? 'exactly' : 'at most';
    return [
      ruleError(
        { ...firstExtra.range, endLine: last.range.endLine, endCharacter: last.range.endCharacter },
        `'${definition.name}' takes ${bound} ${plural(maxArgs)} but got ${args.length}. Remove the extra ` +
          `${args.length - maxArgs === 1 ? 'argument' : 'arguments'}. ${usage}`
      ),
    ];
  }
  return [];
}

/** `1 argument`, `2 arguments`. */
function plural(n: number): string {
  return `${n} ${n === 1 ? 'argument' : 'arguments'}`;
}

/** `a`, `a and b`, `a, b and c`. */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}
