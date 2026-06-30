import { Position } from 'vscode-languageserver/node';
import { HaproxyDocument, SourceRange, HaproxyDirective, DirectiveArg } from '../parser/ast';

export type SymbolKind =
  | 'backend'    // backend/listen section name  ↔  use_backend / default_backend
  | 'defaults'   // defaults section name         ↔  from <name> in section headers
  | 'acl'        // ACL name (section-scoped)     ↔  if / unless conditions
  | 'server'     // server name (section-scoped)  ↔  use-server <name>
  | 'cache'      // cache section name            ↔  http-request cache-use / http-response cache-store
  | 'userlist'   // userlist section name         ↔  http_auth(<name>) / http_auth_group(<name>)
  | 'resolvers'  // resolvers section name        ↔  resolvers <name> in server lines
  | 'peers';     // peers section name            ↔  stick-table … peers <name>

export interface ResolvedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  /** Start line of the containing section header — used to scope ACL and server lookups. */
  readonly scopeHeaderLine?: number;
}

export interface SymbolOccurrence {
  readonly range: SourceRange;
  readonly isDefinition: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_TYPES = new Set(['backend', 'listen']);
const BACKEND_REF_KWS = new Set(['use_backend', 'default_backend']);
const SERVER_KWS = new Set(['server', 'server-template']);

// ─── Public API ───────────────────────────────────────────────────────────────

/** Find the named symbol under the cursor, or null if cursor is not on a resolvable name. */
export function resolveSymbolAtPosition(doc: HaproxyDocument, pos: Position): ResolvedSymbol | null {
  for (const section of doc.sections) {
    const hdrLine = section.headerRange.startLine;

    // Section header: `from <name>` → defaults reference
    if (section.from && contains(section.from.range, pos)) {
      return { name: section.from.value, kind: 'defaults' };
    }

    // Section header: named section → the section's own kind
    if (section.nameToken && contains(section.nameToken.range, pos)) {
      if (BACKEND_TYPES.has(section.type))   return { name: section.nameToken.value, kind: 'backend' };
      if (section.type === 'defaults')        return { name: section.nameToken.value, kind: 'defaults' };
      if (section.type === 'cache')           return { name: section.nameToken.value, kind: 'cache' };
      if (section.type === 'userlist')        return { name: section.nameToken.value, kind: 'userlist' };
      if (section.type === 'resolvers')       return { name: section.nameToken.value, kind: 'resolvers' };
      if (section.type === 'peers')           return { name: section.nameToken.value, kind: 'peers' };
    }

    for (const dir of section.directives) {
      const kw = dir.keyword.value.toLowerCase();

      // use_backend / default_backend <name>
      if (BACKEND_REF_KWS.has(kw)) {
        const a = dir.args[0];
        if (a && !isDynamic(a.value) && contains(a.range, pos)) return { name: a.value, kind: 'backend' };
      }

      // acl <name> <criterion>  →  definition
      if (kw === 'acl') {
        const a = dir.args[0];
        if (a && contains(a.range, pos)) return { name: a.value, kind: 'acl', scopeHeaderLine: hdrLine };
      }

      // if / unless <acl> conditions  →  references
      const condRef = aclInCondition(dir, pos);
      if (condRef) return { name: condRef, kind: 'acl', scopeHeaderLine: hdrLine };

      // use-server <name>
      if (kw === 'use-server') {
        const a = dir.args[0];
        if (a && contains(a.range, pos)) return { name: a.value, kind: 'server', scopeHeaderLine: hdrLine };
      }

      // server / server-template <name>
      if (SERVER_KWS.has(kw)) {
        const a = dir.args[0];
        if (a && contains(a.range, pos)) return { name: a.value, kind: 'server', scopeHeaderLine: hdrLine };
        // server … resolvers <resolver-name>
        const resolversArg = argAfter(dir, 'resolvers');
        if (resolversArg && contains(resolversArg.range, pos)) return { name: resolversArg.value, kind: 'resolvers' };
      }

      // http-request cache-use <name>
      if (kw === 'http-request' && lcArg(dir, 0) === 'cache-use') {
        const a = dir.args[1];
        if (a && contains(a.range, pos)) return { name: a.value, kind: 'cache' };
      }

      // http-response cache-store <name>
      if (kw === 'http-response' && lcArg(dir, 0) === 'cache-store') {
        const a = dir.args[1];
        if (a && contains(a.range, pos)) return { name: a.value, kind: 'cache' };
      }

      // acl … http_auth(<userlist>) / http_auth_group(<userlist>)
      const ulRef = userlistInAcl(dir, pos);
      if (ulRef) return { name: ulRef, kind: 'userlist' };

      // stick-table … peers <name>
      if (kw === 'stick-table') {
        const a = argAfter(dir, 'peers');
        if (a && contains(a.range, pos)) return { name: a.value, kind: 'peers' };
      }
    }
  }
  return null;
}

/** Collect every range where `symbol` appears in the document. */
export function collectOccurrences(doc: HaproxyDocument, symbol: ResolvedSymbol): SymbolOccurrence[] {
  const name = symbol.name.toLowerCase();
  const out: SymbolOccurrence[] = [];

  // Section-scoped: only search within the owning section
  if (symbol.kind === 'acl' || symbol.kind === 'server') {
    const scope = doc.sections.find(s => s.headerRange.startLine === symbol.scopeHeaderLine);
    if (scope) scopedOccurrences(scope.directives, name, symbol.kind, out);
    return out;
  }

  for (const section of doc.sections) {
    // Section header definition tokens
    const nt = section.nameToken;
    if (nt && nt.value.toLowerCase() === name) {
      if (symbol.kind === 'backend'   && BACKEND_TYPES.has(section.type))  out.push({ range: nt.range, isDefinition: true });
      if (symbol.kind === 'defaults'  && section.type === 'defaults')       out.push({ range: nt.range, isDefinition: true });
      if (symbol.kind === 'cache'     && section.type === 'cache')          out.push({ range: nt.range, isDefinition: true });
      if (symbol.kind === 'userlist'  && section.type === 'userlist')       out.push({ range: nt.range, isDefinition: true });
      if (symbol.kind === 'resolvers' && section.type === 'resolvers')      out.push({ range: nt.range, isDefinition: true });
      if (symbol.kind === 'peers'     && section.type === 'peers')          out.push({ range: nt.range, isDefinition: true });
    }

    // `from <name>` tokens → defaults references
    if (symbol.kind === 'defaults' && section.from?.value.toLowerCase() === name) {
      out.push({ range: section.from.range, isDefinition: false });
    }

    for (const dir of section.directives) {
      directiveOccurrences(dir, symbol.kind, name, out);
    }
  }
  return out;
}

export function containsPosition(range: SourceRange, pos: Position): boolean {
  return contains(range, pos);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function scopedOccurrences(
  directives: readonly HaproxyDirective[],
  name: string,
  kind: 'acl' | 'server',
  out: SymbolOccurrence[]
): void {
  for (const dir of directives) {
    const kw = dir.keyword.value.toLowerCase();
    if (kind === 'acl') {
      if (kw === 'acl' && dir.args[0]?.value.toLowerCase() === name) {
        out.push({ range: dir.args[0].range, isDefinition: true });
      }
      for (const arg of conditionArgs(dir)) {
        if (stripNeg(arg.value).toLowerCase() === name) {
          out.push({ range: rangeNoNeg(arg), isDefinition: false });
        }
      }
    } else {
      if (SERVER_KWS.has(kw) && dir.args[0]?.value.toLowerCase() === name) {
        out.push({ range: dir.args[0].range, isDefinition: true });
      }
      if (kw === 'use-server' && dir.args[0]?.value.toLowerCase() === name) {
        out.push({ range: dir.args[0].range, isDefinition: false });
      }
    }
  }
}

function directiveOccurrences(
  dir: HaproxyDirective,
  kind: SymbolKind,
  name: string,
  out: SymbolOccurrence[]
): void {
  const kw = dir.keyword.value.toLowerCase();

  if (kind === 'backend' && BACKEND_REF_KWS.has(kw)) {
    const a = dir.args[0];
    if (a && !isDynamic(a.value) && a.value.toLowerCase() === name) out.push({ range: a.range, isDefinition: false });
    return;
  }

  if (kind === 'cache') {
    if (kw === 'http-request' && lcArg(dir, 0) === 'cache-use') {
      const a = dir.args[1];
      if (a?.value.toLowerCase() === name) out.push({ range: a.range, isDefinition: false });
    }
    if (kw === 'http-response' && lcArg(dir, 0) === 'cache-store') {
      const a = dir.args[1];
      if (a?.value.toLowerCase() === name) out.push({ range: a.range, isDefinition: false });
    }
    return;
  }

  if (kind === 'userlist' && kw === 'acl') {
    for (const arg of dir.args.slice(1)) {
      const ul = extractUserlist(arg.value);
      if (ul?.toLowerCase() === name) out.push({ range: userlistNameRange(arg, ul), isDefinition: false });
    }
    return;
  }

  if (kind === 'resolvers' && SERVER_KWS.has(kw)) {
    const a = argAfter(dir, 'resolvers');
    if (a?.value.toLowerCase() === name) out.push({ range: a.range, isDefinition: false });
    return;
  }

  if (kind === 'peers' && kw === 'stick-table') {
    const a = argAfter(dir, 'peers');
    if (a?.value.toLowerCase() === name) out.push({ range: a.range, isDefinition: false });
    return;
  }
}

// ─── Token / range utilities ──────────────────────────────────────────────────

function aclInCondition(dir: HaproxyDirective, pos: Position): string | null {
  for (const arg of conditionArgs(dir)) {
    if (contains(arg.range, pos)) {
      const stripped = stripNeg(arg.value);
      if (isAclName(stripped)) return stripped;
    }
  }
  return null;
}

function userlistInAcl(dir: HaproxyDirective, pos: Position): string | null {
  if (dir.keyword.value.toLowerCase() !== 'acl') return null;
  for (const arg of dir.args.slice(1)) {
    if (contains(arg.range, pos)) return extractUserlist(arg.value) ?? null;
  }
  return null;
}

function conditionArgs(dir: HaproxyDirective): readonly DirectiveArg[] {
  const idx = dir.args.findIndex(a => { const v = a.value.toLowerCase(); return v === 'if' || v === 'unless'; });
  return idx === -1 ? [] : dir.args.slice(idx + 1);
}

function argAfter(dir: HaproxyDirective, keyword: string): DirectiveArg | undefined {
  const idx = dir.args.findIndex(a => a.value.toLowerCase() === keyword);
  return idx === -1 ? undefined : dir.args[idx + 1];
}

function lcArg(dir: HaproxyDirective, idx: number): string {
  return dir.args[idx]?.value.toLowerCase() ?? '';
}

function extractUserlist(value: string): string | undefined {
  return /^http_auth(?:_group)?\(([^)]+)\)/i.exec(value)?.[1];
}

function userlistNameRange(arg: DirectiveArg, name: string): SourceRange {
  const offset = arg.value.indexOf('(') + 1;
  return {
    startLine: arg.range.startLine,
    startCharacter: arg.range.startCharacter + offset,
    endLine: arg.range.endLine,
    endCharacter: arg.range.startCharacter + offset + name.length,
  };
}

function stripNeg(value: string): string {
  return value.startsWith('!') ? value.slice(1) : value;
}

function rangeNoNeg(arg: DirectiveArg): SourceRange {
  return arg.value.startsWith('!')
    ? { ...arg.range, startCharacter: arg.range.startCharacter + 1 }
    : arg.range;
}

function isAclName(value: string): boolean {
  return value !== '||' && /^[\w][\w\-.]*$/.test(value);
}

function isDynamic(value: string): boolean {
  return value.startsWith('%') || value.startsWith('$');
}

function contains(range: SourceRange, pos: Position): boolean {
  if (pos.line < range.startLine || pos.line > range.endLine) return false;
  if (pos.line === range.startLine && pos.character < range.startCharacter) return false;
  if (pos.line === range.endLine && pos.character > range.endCharacter) return false;
  return true;
}
