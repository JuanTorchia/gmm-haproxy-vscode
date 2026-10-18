import { Hover, MarkupKind, Position, Range } from 'vscode-languageserver/node';
import { HaproxyDocument, HaproxySection, HaproxyDirective, SourceRange, Token } from '../parser/ast';
import { VersionRegistry } from '../registry/versionRegistry';
import { ACTIONS } from '../data/actions';
import { FETCH_METHODS, PREDEFINED_ACLS } from '../data/acl';
import {
  buildActionContent,
  buildDirectiveContent,
  buildFetchDeclContent,
  buildFetchMethodContent,
  buildPredefinedAclContent,
} from './hoverContent';

/**
 * Provides hover documentation for HAProxy directives, action sub-keywords,
 * and ACL fetch method criteria.
 */
export class HoverProvider {
  constructor(
    private readonly registry: VersionRegistry,
    private readonly version: string
  ) {}

  provideHover(doc: HaproxyDocument, position: Position): Hover | null {
    const target = this.findHoverTarget(doc, position);
    if (!target) return null;

    switch (target.type) {
      case 'directive-keyword': {
        const kwName = target.directive.keyword.value.toLowerCase();
        // Try combined "keyword arg[0]" first (e.g. "option httplog", "no option http-server-close")
        const firstArg = target.directive.args[0]?.value.toLowerCase();
        const combinedName = firstArg ? `${kwName} ${firstArg}` : null;
        const def =
          (combinedName ? this.registry.getDirective(combinedName, this.version) : undefined) ??
          this.registry.getDirective(kwName, this.version);
        if (!def) return null;
        const isDeprecated = this.registry.isDeprecated(def.name, this.version);
        return {
          contents: { kind: MarkupKind.Markdown, value: buildDirectiveContent(def, target.section, isDeprecated) },
          range: toRange(target.directive.keyword.range),
        };
      }

      case 'action': {
        const action = ACTIONS.find((a) => a.name === target.name);
        if (!action) return null;
        return {
          contents: { kind: MarkupKind.Markdown, value: buildActionContent(action, target.parentDirective) },
          range: toRange(target.token.range),
        };
      }

      case 'fetch-method': {
        // Try exact fetch method match first
        const method = FETCH_METHODS.find((m) => m.name === target.name);
        if (method) {
          return {
            contents: { kind: MarkupKind.Markdown, value: buildFetchMethodContent(method) },
            range: toRange(target.token.range),
          };
        }
        // Try fetch method declination (e.g. path_beg → path)
        const parent = FETCH_METHODS.find((m) => m.aclDeclinations?.includes(target.name));
        if (parent) {
          return {
            contents: { kind: MarkupKind.Markdown, value: buildFetchDeclContent(target.name, parent) },
            range: toRange(target.token.range),
          };
        }
        // Try pre-defined ACL (case-sensitive names like TRUE, FALSE, METH_GET)
        const predef = PREDEFINED_ACLS.find((p) => p.name === target.name);
        if (predef) {
          return {
            contents: { kind: MarkupKind.Markdown, value: buildPredefinedAclContent(predef) },
            range: toRange(target.token.range),
          };
        }
        return null;
      }
    }
  }

  // ── Target detection ─────────────────────────────────────────────────────

  private findHoverTarget(doc: HaproxyDocument, position: Position): HoverTarget | null {
    for (const section of doc.sections) {
      // Skip section header lines
      if (section.headerRange.startLine === position.line) return null;

      for (const directive of section.directives) {
        // Quick range gate: directive must span the cursor line
        if (
          directive.range.startLine > position.line ||
          directive.range.endLine < position.line
        ) {
          continue;
        }

        // 1. Check keyword token
        const hit = this.checkToken(directive.keyword, position);
        if (hit) {
          return { type: 'directive-keyword', directive, section };
        }

        // 2. Check arg tokens
        const kwName = directive.keyword.value.toLowerCase();
        for (let i = 0; i < directive.args.length; i++) {
          const arg = directive.args[i];
          if (!arg) continue;
          if (!this.checkToken(arg, position)) continue;

          // http-request / http-response / http-after-response → args[0] is the action
          if (
            i === 0 &&
            (kwName === 'http-request' || kwName === 'http-response' || kwName === 'http-after-response')
          ) {
            return {
              type: 'action',
              name: stripFetchArgs(arg.value.toLowerCase()),
              parentDirective: kwName,
              token: arg,
              section,
            };
          }

          // tcp-request / tcp-response → args[0] is the sub-type, args[1] is the action
          if (i === 1 && (kwName === 'tcp-request' || kwName === 'tcp-response')) {
            const subType = directive.args[0]?.value.toLowerCase() ?? '';
            if (subType === 'connection' || subType === 'session' || subType === 'content') {
              return {
                type: 'action',
                name: stripFetchArgs(arg.value.toLowerCase()),
                parentDirective: `${kwName} ${subType}`,
                token: arg,
                section,
              };
            }
          }

          // acl → args[0] is the ACL name, args[1] is the criterion
          if (i === 1 && kwName === 'acl') {
            // Strip parenthesised arguments: hdr(host) → hdr, req.cook(name) → req.cook
            const criterion = stripFetchArgs(arg.value);
            return {
              type: 'fetch-method',
              name: criterion,
              token: arg,
              section,
            };
          }
        }
      }
    }
    return null;
  }

  /** Returns true if the cursor position is within the token's range. */
  private checkToken(token: Token, position: Position): boolean {
    return (
      position.line === token.range.startLine &&
      position.character >= token.range.startCharacter &&
      position.character <= token.range.endCharacter
    );
  }
}

// ── Discriminated union for hover targets ────────────────────────────────

type HoverTarget =
  | {
      type: 'directive-keyword';
      directive: HaproxyDirective;
      section: HaproxySection;
    }
  | {
      type: 'action';
      name: string;
      parentDirective: string;
      token: Token;
      section: HaproxySection;
    }
  | {
      type: 'fetch-method';
      name: string;
      token: Token;
      section: HaproxySection;
    };

// ── Helpers ──────────────────────────────────────────────────────────────

function toRange(r: SourceRange): Range {
  return {
    start: { line: r.startLine, character: r.startCharacter },
    end:   { line: r.endLine,   character: r.endCharacter   },
  };
}

/**
 * Strip the parenthesised argument from a fetch method name so that
 * `hdr(host)` → `hdr` and `req.cook(session_id)` → `req.cook`.
 * Also preserves the exact case for pre-defined ACL lookups (TRUE, METH_GET, etc.).
 */
function stripFetchArgs(raw: string): string {
  const parenIndex = raw.indexOf('(');
  return parenIndex === -1 ? raw : raw.slice(0, parenIndex);
}
