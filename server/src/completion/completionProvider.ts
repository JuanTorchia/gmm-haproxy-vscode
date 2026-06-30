import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  MarkupKind,
  Position,
} from 'vscode-languageserver/node';
import { HaproxyDocument, HaproxySection, SectionType } from '../parser/ast';
import { VersionRegistry } from '../registry/versionRegistry';
import { ACTIONS, ActionRulesets } from '../data/actions';
import { FETCH_METHODS, PREDEFINED_ACLS } from '../data/acl';
import { SERVER_PARAMS } from '../data/server-params';
import { parseLineContext } from './completionContext';
import {
  buildDirectiveDoc, buildActionDoc, buildFetchMethodDoc, buildServerParamDoc,
  allowedFetchLayers, tcpRequestKeywordCompletions, tcpResponseKeywordCompletions,
} from './completionItems';

const SECTION_KEYWORDS: SectionType[] = [
  'global', 'defaults', 'frontend', 'backend', 'listen',
  'userlist', 'peers', 'resolvers', 'mailers', 'ring',
  'log-forward', 'program', 'http-errors', 'cache',
];

/**
 * Provides context-aware completion items for HAProxy config files.
 *
 * Three completion modes, selected by analysing the current line:
 *  1. Section keywords  — cursor is outside any section (col 0 area)
 *  2. Action sub-keywords — cursor follows an action directive (http-request, tcp-request, etc.)
 *  3. ACL fetch methods — cursor follows "acl <name>" (third token position)
 *  4. Directive keywords — default: all directives valid for the current section/mode
 */
export class CompletionProvider {
  constructor(
    private readonly registry: VersionRegistry,
    private readonly version: string
  ) {}

  /**
   * @param doc        Parsed HAProxy document
   * @param position   Cursor position
   * @param linePrefix Text of the current line up to the cursor (used for context detection)
   */
  provideCompletions(
    doc: HaproxyDocument,
    position: Position,
    linePrefix: string = ''
  ): CompletionItem[] {
    const section = this.findSectionAtLine(doc, position.line);

    if (!section) {
      return this.sectionKeywordCompletions();
    }

    const context = parseLineContext(linePrefix);

    switch (context.kind) {
      case 'http-request-action':        return this.actionCompletions({ httpReq: true });
      case 'http-response-action':       return this.actionCompletions({ httpRes: true });
      case 'http-after-response-action': return this.actionCompletions({ httpAft: true });
      case 'tcp-request-connection-action': return this.actionCompletions({ tcpRqCon: true });
      case 'tcp-request-session-action':    return this.actionCompletions({ tcpRqSes: true });
      case 'tcp-request-content-action':    return this.actionCompletions({ tcpRqCnt: true });
      case 'tcp-request-keyword':  return tcpRequestKeywordCompletions();
      case 'tcp-response-action':  return this.actionCompletions({ tcpRsCnt: true });
      case 'tcp-response-keyword': return tcpResponseKeywordCompletions();
      case 'acl-criterion':        return this.fetchMethodCompletions(section);
      case 'server-param':         return this.serverParamCompletions();
      case 'backend-name':         return this.crossRefCompletions(doc, ['backend', 'listen'], 'backend / listen section');
      case 'from-defaults-name':   return this.crossRefCompletions(doc, ['defaults'], 'defaults profile');
      case 'condition-acl-name':   return section ? this.aclNameCompletions(section) : [];
      case 'server-name':          return section ? this.serverNameCompletions(section) : [];
      case 'cache-name':           return this.crossRefCompletions(doc, ['cache'], 'cache section');
      case 'resolvers-name':       return this.crossRefCompletions(doc, ['resolvers'], 'resolvers section');
      case 'peers-name':           return this.crossRefCompletions(doc, ['peers'], 'peers section');
      default:                     return this.directiveCompletions(section);
    }
  }

  // ── Section keywords ───────────────────────────────────────────────────────

  private sectionKeywordCompletions(): CompletionItem[] {
    return SECTION_KEYWORDS.map((kw) => ({
      label: kw,
      kind: CompletionItemKind.Keyword,
      detail: 'HAProxy section',
      documentation: {
        kind: MarkupKind.Markdown,
        value: `Start a new \`${kw}\` section.`,
      },
    }));
  }

  // ── Directive completions (default) ───────────────────────────────────────

  private directiveCompletions(section: HaproxySection): CompletionItem[] {
    const directives = this.registry.getDirectives(this.version);
    const items: CompletionItem[] = [];

    for (const [, def] of directives) {
      if (!def.sections.includes(section.type)) continue;
      if (def.httpOnly && section.mode === 'tcp') continue;
      if (def.tcpOnly && section.mode === 'http') continue;

      const isDeprecated = this.registry.isDeprecated(def.name, this.version);
      const item: CompletionItem = {
        label: def.name,
        kind: CompletionItemKind.Keyword,
        detail: def.signature,
        documentation: { kind: MarkupKind.Markdown, value: buildDirectiveDoc(def, isDeprecated) },
      };
      if (isDeprecated) item.tags = [CompletionItemTag.Deprecated];
      items.push(item);
    }

    items.sort((a, b) => {
      const aD = a.tags?.includes(CompletionItemTag.Deprecated) ? 1 : 0;
      const bD = b.tags?.includes(CompletionItemTag.Deprecated) ? 1 : 0;
      if (aD !== bD) return aD - bD;
      return a.label.localeCompare(b.label);
    });

    return items;
  }

  // ── Action completions ─────────────────────────────────────────────────────

  private actionCompletions(requiredRuleset: Partial<ActionRulesets>): CompletionItem[] {
    const key = Object.keys(requiredRuleset)[0] as keyof ActionRulesets;
    const items: CompletionItem[] = [];

    for (const action of ACTIONS) {
      if (!action.rulesets[key]) continue;
      const isDeprecated = action.deprecated !== undefined;
      const item: CompletionItem = {
        label: action.name,
        kind: CompletionItemKind.Value,
        detail: action.signature || action.name,
        documentation: { kind: MarkupKind.Markdown, value: buildActionDoc(action) },
        sortText: isDeprecated ? `z_${action.name}` : action.name,
      };
      if (isDeprecated) item.tags = [CompletionItemTag.Deprecated];
      items.push(item);
    }

    return items;
  }

  // ── ACL fetch method completions ───────────────────────────────────────────

  private fetchMethodCompletions(section: HaproxySection): CompletionItem[] {
    const items: CompletionItem[] = [];
    const isHttp = section.mode === 'http' || section.type === 'frontend' || section.type === 'backend';
    const allowedLayers = allowedFetchLayers(isHttp);

    for (const method of FETCH_METHODS) {
      if (!allowedLayers.has(method.layer)) continue;
      items.push({
        label: method.name,
        kind: CompletionItemKind.Function,
        detail: `${method.name}${method.signature} : ${method.outputType}`,
        documentation: { kind: MarkupKind.Markdown, value: buildFetchMethodDoc(method) },
        sortText: `a_${method.name}`,
      });
      if (method.aclDeclinations) {
        for (const decl of method.aclDeclinations) {
          if (decl === method.name) continue;
          items.push({
            label: decl,
            kind: CompletionItemKind.Function,
            detail: `${decl} (ACL variant of ${method.name}) : ${method.outputType}`,
            documentation: {
              kind: MarkupKind.Markdown,
              value: `ACL declination of \`${method.name}\`.\n\n${method.description}`,
            },
            sortText: `b_${decl}`,
          });
        }
      }
    }

    for (const predef of PREDEFINED_ACLS) {
      items.push({
        label: predef.name,
        kind: CompletionItemKind.Constant,
        detail: `≡ ${predef.equivalent}`,
        documentation: {
          kind: MarkupKind.Markdown,
          value: `**Pre-defined ACL**\n\n${predef.description}\n\nEquivalent to: \`${predef.equivalent}\``,
        },
        sortText: `c_${predef.name}`,
      });
    }

    return items;
  }

  // ── Server parameter completions ──────────────────────────────────────────

  private serverParamCompletions(): CompletionItem[] {
    const items: CompletionItem[] = [];
    for (const param of SERVER_PARAMS) {
      const isDeprecated = param.deprecated !== undefined;
      const item: CompletionItem = {
        label: param.name,
        kind: CompletionItemKind.Property,
        detail: param.signature ? `${param.name} ${param.signature}` : param.name,
        documentation: { kind: MarkupKind.Markdown, value: buildServerParamDoc(param, isDeprecated) },
        sortText: isDeprecated ? `z_${param.name}` : param.name,
      };
      if (isDeprecated) item.tags = [CompletionItemTag.Deprecated];
      items.push(item);
    }
    return items;
  }

  // ── Cross-reference name completions ─────────────────────────────────────

  private crossRefCompletions(
    doc: HaproxyDocument,
    types: SectionType[],
    detail: string
  ): CompletionItem[] {
    const seen = new Set<string>();
    const items: CompletionItem[] = [];
    for (const section of doc.sections) {
      if (types.includes(section.type) && section.name && !seen.has(section.name)) {
        seen.add(section.name);
        items.push({ label: section.name, kind: CompletionItemKind.Reference, detail });
      }
    }
    return items;
  }

  private aclNameCompletions(section: HaproxySection): CompletionItem[] {
    const seen = new Set<string>();
    const items: CompletionItem[] = [];
    for (const dir of section.directives) {
      if (dir.keyword.value.toLowerCase() === 'acl') {
        const name = dir.args[0]?.value;
        if (name && !seen.has(name)) {
          seen.add(name);
          items.push({ label: name, kind: CompletionItemKind.Reference, detail: 'ACL' });
        }
      }
    }
    return items;
  }

  private serverNameCompletions(section: HaproxySection): CompletionItem[] {
    const seen = new Set<string>();
    const items: CompletionItem[] = [];
    for (const dir of section.directives) {
      const kw = dir.keyword.value.toLowerCase();
      if (kw === 'server' || kw === 'server-template') {
        const name = dir.args[0]?.value;
        if (name && !seen.has(name)) {
          seen.add(name);
          items.push({ label: name, kind: CompletionItemKind.Reference, detail: 'server' });
        }
      }
    }
    return items;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private findSectionAtLine(doc: HaproxyDocument, line: number): HaproxySection | null {
    let active: HaproxySection | null = null;
    for (const section of doc.sections) {
      if (section.headerRange.startLine <= line) {
        active = section;
      } else {
        break;
      }
    }
    return active;
  }
}
