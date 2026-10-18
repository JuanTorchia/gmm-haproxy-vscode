import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective } from '../../parser/ast';
import { ACTIONS, ActionRulesets } from '../../data/actions';
import { RuleContext, ruleError, ruleWarning } from './shared';

/**
 * Maps a fully-resolved directive name (e.g. "tcp-request connection") to the
 * ActionRulesets key and the arg index that contains the action sub-keyword.
 */
const ACTION_DIRECTIVE_RULESETS: Record<string, { key: keyof ActionRulesets; actionArgIdx: number }> = {
  'http-request':            { key: 'httpReq', actionArgIdx: 0 },
  'http-response':           { key: 'httpRes', actionArgIdx: 0 },
  'http-after-response':     { key: 'httpAft', actionArgIdx: 0 },
  'tcp-request connection':  { key: 'tcpRqCon', actionArgIdx: 1 },
  'tcp-request session':     { key: 'tcpRqSes', actionArgIdx: 1 },
  'tcp-request content':     { key: 'tcpRqCnt', actionArgIdx: 1 },
  'tcp-response content':    { key: 'tcpRsCnt', actionArgIdx: 1 },
};

/**
 * Validates the action sub-keyword of rule directives such as
 * `http-request deny` or `tcp-request connection accept`.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns An error for an unknown or misplaced action, a warning for a
 *   deprecated one; empty for directives that take no action.
 */
export function actionKeywordRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  const { resolvedName, registry, version } = context;
  const mapping = ACTION_DIRECTIVE_RULESETS[resolvedName];
  if (!mapping) return [];

  const actionArg = directive.args[mapping.actionArgIdx];
  if (!actionArg) return []; // no action provided — incomplete line, nothing to check

  const actionName = stripParens(actionArg.value.toLowerCase());
  const action = ACTIONS.find((a) => a.name === actionName);

  if (!action) {
    return [ruleError(actionArg.range, `Unknown ${resolvedName} action '${actionArg.value}'.`)];
  }
  if (!action.rulesets[mapping.key]) {
    return [ruleError(actionArg.range, `'${actionName}' is not a valid action for '${resolvedName}'.`)];
  }
  if (action.deprecated && registry.compareVersions(version, action.deprecated) >= 0) {
    return [ruleWarning(actionArg.range, `'${actionName}' is deprecated since HAProxy ${action.deprecated}.`)];
  }
  return [];
}

/** Strip parenthesised arguments from an action/fetch token: set-var(x) → set-var */
function stripParens(raw: string): string {
  const idx = raw.indexOf('(');
  return idx === -1 ? raw : raw.slice(0, idx);
}
