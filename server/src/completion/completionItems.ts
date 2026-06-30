/**
 * Pure data-building helpers extracted from CompletionProvider to keep
 * completionProvider.ts under 300 lines.  No logic changes.
 */
import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from 'vscode-languageserver/node';
import { DirectiveDefinition } from '../registry/versionRegistry';
import { ActionDef, ActionRulesets } from '../data/actions';
import { FetchMethodDef, FetchLayer } from '../data/acl';
import { ServerParamDef } from '../data/server-params';

// ── Doc builders ──────────────────────────────────────────────────────────────

export function buildDirectiveDoc(def: DirectiveDefinition, isDeprecated: boolean): string {
  const lines: string[] = [def.description, ''];
  lines.push(`**Since:** HAProxy ${def.sinceVersion}`);
  if (isDeprecated && def.deprecatedSinceVersion) {
    lines.push(`**Deprecated since:** HAProxy ${def.deprecatedSinceVersion}`);
  }
  if (def.docsUrl) {
    lines.push('', `[📖 HAProxy Docs](${def.docsUrl})`);
  }
  return lines.join('\n');
}

export function buildActionDoc(action: ActionDef): string {
  const lines: string[] = [action.description, ''];
  lines.push(`**Since:** HAProxy ${action.since}`);
  if (action.deprecated) {
    lines.push(`**Deprecated since:** HAProxy ${action.deprecated}`);
  }
  lines.push('', `**Valid in:** ${describeRulesets(action.rulesets)}`);
  return lines.join('\n');
}

export function buildFetchMethodDoc(method: FetchMethodDef): string {
  const lines: string[] = [method.description, ''];
  lines.push(`**Output type:** ${method.outputType}`);
  lines.push(`**Layer:** ${method.layer}`);
  lines.push(`**Since:** HAProxy ${method.since}`);
  if (method.aclDeclinations && method.aclDeclinations.length > 1) {
    lines.push('', `**ACL variants:** ${method.aclDeclinations.join(', ')}`);
  }
  return lines.join('\n');
}

export function buildServerParamDoc(param: ServerParamDef, isDeprecated: boolean): string {
  const lines: string[] = [param.description, ''];
  lines.push(`**Since:** HAProxy ${param.since}`);
  if (isDeprecated && param.deprecated) {
    lines.push(`**Deprecated since:** HAProxy ${param.deprecated}`);
  }
  if (param.removed) {
    lines.push(`**Removed in:** HAProxy ${param.removed}`);
  }
  return lines.join('\n');
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function allowedFetchLayers(isHttpMode: boolean): Set<FetchLayer> {
  const layers: FetchLayer[] = ['internal', 'L4', 'L5', 'L6'];
  if (isHttpMode) layers.push('L7');
  return new Set(layers);
}

export function describeRulesets(rs: ActionRulesets): string {
  const parts: string[] = [];
  if (rs.httpReq) parts.push('http-request');
  if (rs.httpRes) parts.push('http-response');
  if (rs.httpAft) parts.push('http-after-response');
  if (rs.tcpRqCon) parts.push('tcp-request connection');
  if (rs.tcpRqSes) parts.push('tcp-request session');
  if (rs.tcpRqCnt) parts.push('tcp-request content');
  if (rs.tcpRsCnt) parts.push('tcp-response content');
  if (rs.quicIni) parts.push('quic-initial');
  return parts.join(', ');
}

// ── tcp-request / tcp-response sub-type keyword completions ──────────────────

export function tcpRequestKeywordCompletions(): CompletionItem[] {
  return [
    {
      label: 'connection',
      kind: CompletionItemKind.Keyword,
      detail: 'tcp-request connection <action> [cond]',
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Rules evaluated right after a connection is accepted, before any data is received.',
      },
    },
    {
      label: 'session',
      kind: CompletionItemKind.Keyword,
      detail: 'tcp-request session <action> [cond]',
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Rules evaluated after a session is established (post-handshake).',
      },
    },
    {
      label: 'content',
      kind: CompletionItemKind.Keyword,
      detail: 'tcp-request content <action> [cond]',
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Rules evaluated after content is available in the request buffer.',
      },
    },
    {
      label: 'inspect-delay',
      kind: CompletionItemKind.Keyword,
      detail: 'tcp-request inspect-delay <timeout>',
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Set the maximum time to wait for data before evaluating content rules.',
      },
    },
  ];
}

export function tcpResponseKeywordCompletions(): CompletionItem[] {
  return [
    {
      label: 'content',
      kind: CompletionItemKind.Keyword,
      detail: 'tcp-response content <action> [cond]',
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Rules evaluated after content is available in the response buffer.',
      },
    },
    {
      label: 'inspect-delay',
      kind: CompletionItemKind.Keyword,
      detail: 'tcp-response inspect-delay <timeout>',
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Set the maximum time to wait for response data before evaluating content rules.',
      },
    },
  ];
}
