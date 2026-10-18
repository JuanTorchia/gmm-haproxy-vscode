import { HaproxySection } from '../parser/ast';
import { DirectiveDefinition } from '../registry/versionRegistry';
import { ActionDef, ActionRulesets } from '../data/actions';
import { FetchMethodDef, PredefinedAcl } from '../data/acl';

/**
 * Render the hover Markdown for a directive keyword.
 * @param def - Directive definition resolved for the active version.
 * @param section - Section containing the hovered directive (used for its mode).
 * @param isDeprecated - Whether the directive is deprecated in the active version.
 * @returns Markdown hover body.
 */
export function buildDirectiveContent(
  def: DirectiveDefinition,
  section: HaproxySection,
  isDeprecated: boolean
): string {
  const lines: string[] = [];

  lines.push(`**\`${def.name}\`** \`${def.signature}\``);
  lines.push('---');
  lines.push(def.description);
  lines.push('');
  lines.push(`**Valid in:** ${def.sections.join(', ')}`);

  const versionParts: string[] = [`**Since:** HAProxy ${def.sinceVersion}`];
  if (isDeprecated && def.deprecatedSinceVersion) {
    versionParts.push(`~~**Deprecated in:** ${def.deprecatedSinceVersion}~~`);
  }
  if (def.removedInVersion) {
    versionParts.push(`**Removed in:** ${def.removedInVersion}`);
  }
  lines.push(versionParts.join('  |  '));

  if (def.httpOnly) lines.push('**Requires:** HTTP mode');
  if (def.tcpOnly)  lines.push('**Requires:** TCP mode');
  if (section.mode) lines.push(`**Current mode:** ${section.mode}`);

  if (def.docsUrl) {
    lines.push('');
    lines.push(`[📖 HAProxy Docs](${def.docsUrl})`);
  }

  return lines.join('\n');
}

/**
 * Render the hover Markdown for an action sub-keyword (e.g. `http-request set-header`).
 * @param action - Action definition.
 * @param parentDirective - Rule set the action appears in (e.g. `tcp-request content`).
 * @returns Markdown hover body.
 */
export function buildActionContent(action: ActionDef, parentDirective: string): string {
  const lines: string[] = [];

  const sigPart = action.signature ? ` \`${action.signature}\`` : '';
  lines.push(`**\`${action.name}\`**${sigPart}`);
  lines.push('---');
  lines.push(action.description);
  lines.push('');
  lines.push(`**Rule set:** \`${parentDirective}\``);
  lines.push(`**Valid in:** ${describeRulesets(action.rulesets)}`);
  lines.push(`**Since:** HAProxy ${action.since}`);

  if (action.deprecated) {
    lines.push(`~~**Deprecated in:** ${action.deprecated}~~`);
  }

  return lines.join('\n');
}

/**
 * Render the hover Markdown for an ACL fetch method.
 * @param method - Fetch method definition.
 * @returns Markdown hover body.
 */
export function buildFetchMethodContent(method: FetchMethodDef): string {
  const lines: string[] = [];

  const sigPart = method.signature ? `\`${method.signature}\`` : '';
  lines.push(`**\`${method.name}\`** ${sigPart} → \`${method.outputType}\``);
  lines.push('---');
  lines.push(method.description);
  lines.push('');
  lines.push(`**Layer:** ${method.layer}  |  **Since:** HAProxy ${method.since}`);

  if (method.aclDeclinations && method.aclDeclinations.length > 1) {
    lines.push('');
    lines.push(`**ACL variants:** \`${method.aclDeclinations.join('`  `')}\``);
  }

  return lines.join('\n');
}

/**
 * Render the hover Markdown for an ACL declination of a fetch method (e.g. `path_beg`).
 * @param declName - Hovered declination name.
 * @param parent - Fetch method the declination belongs to.
 * @returns Markdown hover body.
 */
export function buildFetchDeclContent(declName: string, parent: FetchMethodDef): string {
  const lines: string[] = [];

  lines.push(`**\`${declName}\`** → \`${parent.outputType}\``);
  lines.push('---');
  lines.push(`ACL declination of \`${parent.name}\`.`);
  lines.push('');
  lines.push(parent.description);
  lines.push('');
  lines.push(`**Layer:** ${parent.layer}  |  **Since:** HAProxy ${parent.since}`);
  lines.push('');
  lines.push(`**All variants:** \`${(parent.aclDeclinations ?? [parent.name]).join('`  `')}\``);

  return lines.join('\n');
}

/**
 * Render the hover Markdown for a pre-defined ACL (e.g. `TRUE`, `METH_GET`).
 * @param predef - Pre-defined ACL definition.
 * @returns Markdown hover body.
 */
export function buildPredefinedAclContent(predef: PredefinedAcl): string {
  const lines: string[] = [];

  lines.push(`**\`${predef.name}\`** *(pre-defined ACL)*`);
  lines.push('---');
  lines.push(predef.description);
  lines.push('');
  lines.push(`**Equivalent to:** \`${predef.equivalent}\``);

  return lines.join('\n');
}

/** Human-readable ruleset summary for action hover. */
function describeRulesets(rs: ActionRulesets): string {
  const parts: string[] = [];
  if (rs.httpReq)  parts.push('`http-request`');
  if (rs.httpRes)  parts.push('`http-response`');
  if (rs.httpAft)  parts.push('`http-after-response`');
  if (rs.tcpRqCon) parts.push('`tcp-request connection`');
  if (rs.tcpRqSes) parts.push('`tcp-request session`');
  if (rs.tcpRqCnt) parts.push('`tcp-request content`');
  if (rs.tcpRsCnt) parts.push('`tcp-response content`');
  if (rs.quicIni)  parts.push('`quic-initial`');
  return parts.join(', ');
}
