import { Diagnostic } from 'vscode-languageserver/node';
import { HaproxyDirective } from '../../parser/ast';
import { RuleContext, ruleError } from './shared';

const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * Upper bound on an address token we are willing to inspect. Config content is
 * untrusted input, and no legitimate bind address approaches this length.
 */
const MAX_ADDRESS_LENGTH = 256;

/**
 * Address prefixes that name a socket rather than a host, and therefore carry
 * no port. `ipv4@` and `ipv6@` are deliberately absent — those do take one.
 */
const PORTLESS_PREFIXES = ['unix@', 'abns@', 'abnsz@', 'fd@', 'sockpair@'];

/** Which argument of a directive holds its address, by resolved directive name. */
const ADDRESS_ARG_INDEX: Record<string, number> = {
  bind: 0,
  server: 1,
};

/**
 * A port position extracted from an address, kept with its offset inside the
 * argument so the diagnostic can underline the port rather than the whole token.
 */
interface PortRef {
  readonly text: string;
  readonly offset: number;
}

/**
 * Validates port numbers in `bind` and `server` addresses.
 *
 * Only reports a port it can identify unambiguously. Unix socket paths, `fd@`
 * style addresses, environment substitutions and bracket-less IPv6 literals are
 * skipped rather than guessed at, because a false positive on a production
 * config is worse than a missed check.
 *
 * @param directive - The directive node to inspect.
 * @param context - Resolved directive metadata.
 * @returns Diagnostics for out-of-range ports; empty when every port is valid or undeterminable.
 */
export function portRangeRule(directive: HaproxyDirective, context: RuleContext): Diagnostic[] {
  const argIndex = ADDRESS_ARG_INDEX[context.resolvedName];
  if (argIndex === undefined) return [];

  const arg = directive.args[argIndex];
  if (!arg || arg.value.length > MAX_ADDRESS_LENGTH) return [];

  // `server` accepts port 0, which means "inherit the port of the incoming
  // connection". For `bind` there is no such meaning.
  const zeroAllowed = context.resolvedName === 'server';

  const out: Diagnostic[] = [];
  for (const ref of extractPorts(arg.value)) {
    const port = Number(ref.text);
    if (port === 0 && zeroAllowed) continue;
    if (port >= MIN_PORT && port <= MAX_PORT) continue;

    const start = arg.range.startCharacter + ref.offset;
    out.push(
      ruleError(
        {
          startLine: arg.range.startLine,
          startCharacter: start,
          endLine: arg.range.startLine,
          endCharacter: start + ref.text.length,
        },
        `Port ${ref.text} is out of range. Valid ports are ${MIN_PORT}-${MAX_PORT}` +
          (zeroAllowed ? `, or 0 to inherit the incoming port.` : `.`)
      )
    );
  }
  return out;
}

/**
 * Extracts every numeric port in an address argument.
 *
 * @param value - Raw address argument, which may list several addresses separated by commas.
 * @returns Each port found, with its offset inside `value`.
 */
function extractPorts(value: string): PortRef[] {
  if (value.includes('$')) return []; // environment substitution

  const refs: PortRef[] = [];
  let cursor = 0;
  for (const part of value.split(',')) {
    const base = cursor;
    cursor += part.length + 1; // +1 for the comma
    const portField = portFieldOf(part);
    if (!portField) continue;

    // A range such as `8080-8090` bounds two ports.
    let segStart = portField.offset;
    for (const seg of portField.text.split('-')) {
      if (seg.length > 0 && isAllDigits(seg)) {
        refs.push({ text: seg, offset: base + segStart });
      }
      segStart += seg.length + 1; // +1 for the dash
    }
  }
  return refs;
}

/**
 * Locates the port field of a single address, or `null` when the address has no
 * determinable port.
 *
 * @param addr - One address, already split off any comma-separated list.
 * @returns The port text and its offset within `addr`, or `null`.
 */
function portFieldOf(addr: string): PortRef | null {
  if (addr.startsWith('/')) return null; // unix socket path
  if (PORTLESS_PREFIXES.some((p) => addr.startsWith(p))) return null;

  // Bracketed IPv6: the port, if any, follows `]:`.
  if (addr.startsWith('[')) {
    const close = addr.indexOf(']');
    if (close === -1 || addr[close + 1] !== ':') return null;
    return { text: addr.slice(close + 2), offset: close + 2 };
  }

  const lastColon = addr.lastIndexOf(':');
  if (lastColon === -1) return null; // no port — `server` inherits it

  // Everything before the port. `:80` and `:::80` (all-IPv6) are addresses we
  // understand; anything else containing a colon is a bracket-less IPv6
  // literal whose port cannot be told apart from its last group.
  const host = addr.slice(0, lastColon);
  if (host.includes(':') && host !== ':' && host !== '::') return null;

  return { text: addr.slice(lastColon + 1), offset: lastColon + 1 };
}

function isAllDigits(s: string): boolean {
  if (s.length === 0 || s.length > 10) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}
