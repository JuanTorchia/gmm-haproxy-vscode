import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective, SourceRange } from '../../parser/ast';
import { RuleContext, ruleError, ruleWarning } from './shared';

/**
 * Time units accepted by HAProxy in a time value, ordered longest-first so the
 * suffix match is unambiguous.
 */
const TIME_UNITS = ['us', 'ms', 's', 'm', 'h', 'd'] as const;

/**
 * Upper bound on the length of a value we are willing to pattern-match.
 * Config content is untrusted input; this caps the work any single token can
 * cause regardless of how the expression is written.
 */
const MAX_VALUE_LENGTH = 32;

/** Digits followed by an optional unit suffix. Linear-time: no nesting, no alternation backtracking. */
const TIME_VALUE = /^(\d{1,15})(us|ms|s|m|h|d)?$/;

/**
 * `http-request set-timeout` is an action with its own `<name> <value>` shape,
 * not a directive taking a bare time value. It would otherwise be caught by the
 * `-timeout` suffix test below.
 */
const NOT_A_TIME_DIRECTIVE = new Set(['set-timeout']);

/**
 * Reports whether a resolved directive name takes a time value as its first argument.
 *
 * @param resolvedName - Directive name as resolved by the registry.
 * @returns `true` when the directive's first argument is a HAProxy time value.
 */
export function takesTimeValue(resolvedName: string): boolean {
  if (NOT_A_TIME_DIRECTIVE.has(resolvedName)) return false;
  return (
    resolvedName.startsWith('timeout ') ||
    resolvedName.endsWith(' timeout') ||
    resolvedName.endsWith('-timeout') ||
    resolvedName.endsWith('inspect-delay')
  );
}

/**
 * Validates the time value of a timeout-style directive.
 *
 * A bare number is legal HAProxy config and is interpreted as milliseconds, so
 * `timeout connect 5` loads cleanly and means 5ms. That is almost never the
 * intent, but the config does load — per the severity rules it is a Warning,
 * not an Error. A value HAProxy cannot parse at all stops the config from
 * loading and is an Error.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns Diagnostics for this directive; empty when the value is well-formed.
 */
export function timeoutValueRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  if (!takesTimeValue(context.resolvedName)) return [];

  // The value sits immediately after the tokens that spell the directive name.
  // `timeout connect 5s` -> name is 2 words -> args[1]. `tune.lua.task-timeout 4s` -> args[0].
  const valueIndex = context.resolvedName.split(' ').length - 1;
  const arg = directive.args[valueIndex];
  if (!arg) return []; // missing argument — not this rule's concern

  const raw = arg.value;

  // Environment variables and quoted expressions are resolved by HAProxy at
  // load time; their contents cannot be checked here.
  if (raw.includes('$') || raw.includes('"') || raw.includes("'")) return [];

  if (raw.length > MAX_VALUE_LENGTH) {
    return [invalidFormat(arg.range, context.resolvedName, raw)];
  }

  const match = TIME_VALUE.exec(raw);
  if (!match) {
    return [invalidFormat(arg.range, context.resolvedName, raw)];
  }

  const [, digits, unit] = match;
  if (unit) return [];

  // `timeout connect 5 s` — the unit was typed but separated by a space, so it
  // parsed as a second argument. HAProxy rejects the extra token.
  const next = directive.args[valueIndex + 1]?.value;
  if (next && (TIME_UNITS as readonly string[]).includes(next)) {
    return [
      ruleError(
        arg.range,
        `'${context.resolvedName} ${raw} ${next}' has a space between the value and its unit. ` +
          `Write '${raw}${next}' as a single token.`
      ),
    ];
  }

  // `0` disables the timeout regardless of unit, so it is written deliberately
  // and a "did you mean seconds?" warning would be noise.
  if (Number(digits) === 0) return [];

  return [
    ruleWarning(
      arg.range,
      `'${context.resolvedName} ${raw}' is ${raw} milliseconds. ` +
        `HAProxy reads a time value with no unit as milliseconds. ` +
        `Write '${raw}s' for ${raw} seconds, or add an explicit unit (us, ms, s, m, h, d).`
    ),
  ];
}

function invalidFormat(range: SourceRange, name: string, raw: string): Diagnostic {
  return ruleError(
    range,
      `'${raw}' is not a valid time value for '${name}'. ` +
      `Use a number followed by a unit: ${TIME_UNITS.join(', ')} — for example '5s'.`,
  );
}

