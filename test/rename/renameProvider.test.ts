import { HaproxyParser } from '../../server/src/parser/parser';
import { RenameProvider } from '../../server/src/rename/renameProvider';

const parser = new HaproxyParser();
const provider = new RenameProvider();

const URI = 'test://rename';

/** Edits produced by renaming the symbol under the cursor, or null. */
function rename(text: string, line: number, character: number, newName: string) {
  const doc = parser.parse(text, URI);
  const edit = provider.provideRename(doc, { line, character }, newName);
  return edit?.changes?.[URI] ?? null;
}

function prepare(text: string, line: number, character: number) {
  const doc = parser.parse(text, URI);
  return provider.prepareRename(doc, { line, character });
}

/**
 * Applies a rename to the source text so the test asserts on the resulting
 * config rather than on edit coordinates. Edits are applied last-first so
 * earlier offsets stay valid.
 */
function applyRename(text: string, line: number, character: number, newName: string): string {
  const edits = rename(text, line, character, newName);
  if (!edits) return text;
  const lines = text.split('\n');
  const ordered = [...edits].sort(
    (a, b) => b.range.start.line - a.range.start.line || b.range.start.character - a.range.start.character
  );
  for (const e of ordered) {
    const l = lines[e.range.start.line] ?? '';
    lines[e.range.start.line] =
      l.slice(0, e.range.start.character) + e.newText + l.slice(e.range.end.character);
  }
  return lines.join('\n');
}

describe('RenameProvider', () => {
  describe('backend names', () => {
    const config = [
      'frontend http',
      '    default_backend web',
      '    use_backend web if is_api',
      'backend web',
      '    server s1 10.0.0.1:80',
    ].join('\n');

    it('rewrites the definition and every reference', () => {
      // cursor on "web" in the backend header (line 3)
      expect(applyRename(config, 3, 9, 'web_v2')).toBe(
        [
          'frontend http',
          '    default_backend web_v2',
          '    use_backend web_v2 if is_api',
          'backend web_v2',
          '    server s1 10.0.0.1:80',
        ].join('\n')
      );
    });

    it('produces the same result when started from a reference', () => {
      // cursor on "web" in use_backend (line 2)
      expect(applyRename(config, 2, 17, 'web_v2')).toBe(applyRename(config, 3, 9, 'web_v2'));
    });

    it('leaves no occurrence of the old name behind', () => {
      expect(applyRename(config, 3, 9, 'web_v2')).not.toMatch(/\bweb\b/);
    });

    it('does not rewrite a name that merely contains the old one as a substring', () => {
      const text = [
        'frontend http',
        '    use_backend web',
        '    use_backend web_static',
        'backend web',
        'backend web_static',
      ].join('\n');
      const result = applyRename(text, 3, 9, 'api');
      expect(result).toContain('use_backend web_static');
      expect(result).toContain('backend web_static');
      expect(result).toContain('use_backend api');
    });

    it('covers a listen section, which is both frontend and backend', () => {
      const text = ['frontend f', '    use_backend app', 'listen app', '    bind :80'].join('\n');
      const result = applyRename(text, 2, 8, 'app2');
      expect(result).toContain('use_backend app2');
      expect(result).toContain('listen app2');
    });
  });

  describe('ACL names', () => {
    const config = [
      'frontend http',
      '    acl is_api path_beg /api',
      '    use_backend api if is_api',
      '    http-request deny if !is_api',
    ].join('\n');

    it('rewrites the definition and both condition uses', () => {
      const result = applyRename(config, 1, 9, 'is_api_v2');
      expect(result).toContain('acl is_api_v2 path_beg /api');
      expect(result).toContain('use_backend api if is_api_v2');
    });

    it('preserves the negation marker when renaming a negated reference', () => {
      // The `!` must survive — rewriting it away would invert the rule.
      expect(applyRename(config, 1, 9, 'is_api_v2')).toContain('http-request deny if !is_api_v2');
    });

    it('is scoped to the owning section', () => {
      const text = [
        'frontend a',
        '    acl internal src 10.0.0.0/8',
        '    http-request deny if internal',
        'frontend b',
        '    acl internal src 192.168.0.0/16',
        '    http-request deny if internal',
      ].join('\n');
      const result = applyRename(text, 1, 9, 'corp');
      // Only frontend a is rewritten; frontend b keeps its own `internal`.
      expect(result.split('\n')[1]).toContain('acl corp');
      expect(result.split('\n')[2]).toContain('if corp');
      expect(result.split('\n')[4]).toContain('acl internal');
      expect(result.split('\n')[5]).toContain('if internal');
    });
  });

  describe('server names', () => {
    it('rewrites a server definition and its use-server reference', () => {
      const text = [
        'backend web',
        '    server s1 10.0.0.1:80',
        '    use-server s1 if is_canary',
      ].join('\n');
      const result = applyRename(text, 1, 12, 'canary');
      expect(result).toContain('server canary 10.0.0.1:80');
      expect(result).toContain('use-server canary if is_canary');
    });
  });

  describe('other named sections', () => {
    it('renames a cache and its cache-use reference', () => {
      const text = [
        'cache static',
        '    total-max-size 100',
        'backend b',
        '    http-request cache-use static',
      ].join('\n');
      const result = applyRename(text, 0, 7, 'assets');
      expect(result).toContain('cache assets');
      expect(result).toContain('http-request cache-use assets');
    });

    it('renames a resolvers section and its server reference', () => {
      const text = [
        'resolvers dns',
        '    nameserver ns1 10.0.0.1:53',
        'backend b',
        '    server s1 app.internal:80 resolvers dns',
      ].join('\n');
      const result = applyRename(text, 0, 11, 'corpdns');
      expect(result).toContain('resolvers corpdns');
      expect(result).toContain('resolvers corpdns');
    });

    it('renames a peers section and its stick-table reference', () => {
      const text = [
        'peers mypeers',
        '    peer node1 10.0.0.1:1024',
        'backend b',
        '    stick-table type ip size 1m peers mypeers',
      ].join('\n');
      const result = applyRename(text, 0, 7, 'cluster');
      expect(result).toContain('peers cluster');
      expect(result).toContain('peers cluster');
    });

    it('renames a userlist and its http_auth reference, keeping the parentheses', () => {
      const text = [
        'userlist staff',
        '    user alice password xxx',
        'frontend http',
        '    acl is_auth http_auth(staff)',
      ].join('\n');
      const result = applyRename(text, 0, 10, 'admins');
      expect(result).toContain('userlist admins');
      expect(result).toContain('http_auth(admins)');
    });

    it('renames a userlist referenced through http_auth_group', () => {
      const text = [
        'userlist staff',
        '    group ops',
        'frontend http',
        '    acl is_ops http_auth_group(staff) ops',
      ].join('\n');
      expect(applyRename(text, 0, 10, 'admins')).toContain('http_auth_group(admins)');
    });

    it('renames a cache referenced through http-response cache-store', () => {
      const text = [
        'cache static',
        '    total-max-size 100',
        'backend b',
        '    http-response cache-store static',
      ].join('\n');
      const result = applyRename(text, 0, 7, 'assets');
      expect(result).toContain('cache assets');
      expect(result).toContain('http-response cache-store assets');
    });

    it('renames a resolvers section starting from the server-line reference', () => {
      const text = [
        'resolvers dns',
        '    nameserver ns1 10.0.0.1:53',
        'backend b',
        '    server s1 app.internal:80 resolvers dns',
      ].join('\n');
      // cursor on `dns` in the server line, not the section header
      const result = applyRename(text, 3, 40, 'corpdns');
      expect(result).toContain('resolvers corpdns');
      expect(result.split('\n')[3]).toContain('resolvers corpdns');
    });

    it('renames a server through server-template', () => {
      const text = ['backend web', '    server-template srv 1-3 10.0.0.1:80 check'].join('\n');
      expect(applyRename(text, 1, 21, 'node')).toContain('server-template node 1-3');
    });

    it('renames a named defaults section and its `from` reference', () => {
      const text = ['defaults base', '    mode http', 'backend b from base', '    balance roundrobin'].join('\n');
      const result = applyRename(text, 0, 10, 'common');
      expect(result).toContain('defaults common');
      expect(result).toContain('backend b from common');
    });
  });

  describe('positions that are not renameable', () => {
    const config = ['frontend http', '    use_backend web', 'backend web'].join('\n');

    it('returns null on a directive keyword', () => {
      expect(rename(config, 1, 6, 'x')).toBeNull();
    });

    it('returns null on a section type keyword', () => {
      expect(rename(config, 0, 2, 'x')).toBeNull();
    });

    it('returns null on an empty line', () => {
      expect(rename('frontend http\n\nbackend web', 1, 0, 'x')).toBeNull();
    });

    it('returns null past the end of a line', () => {
      expect(rename(config, 1, 200, 'x')).toBeNull();
    });

    it('does not resolve a dynamic backend expression', () => {
      // `use_backend %[req.hdr(host)]` names no static symbol.
      const text = 'frontend http\n    use_backend %[req.hdr(host)]\n';
      expect(rename(text, 1, 20, 'x')).toBeNull();
    });
  });

  describe('prepareRename', () => {
    const config = ['frontend http', '    use_backend web', 'backend web'].join('\n');

    it('returns the current name as the placeholder', () => {
      expect(prepare(config, 2, 9)?.placeholder).toBe('web');
    });

    it('returns the range of the name only, not the whole line', () => {
      const range = prepare(config, 2, 9)?.range;
      expect(range?.start.character).toBe(8);
      expect(range?.end.character).toBe(11);
    });

    it('refuses a position that is not a renameable symbol', () => {
      expect(prepare(config, 1, 6)).toBeNull();
    });

    it('agrees with provideRename about what is renameable', () => {
      // A position prepareRename accepts must produce edits, and vice versa.
      for (const [line, char] of [
        [2, 9],
        [1, 17],
        [1, 6],
        [0, 2],
      ] as const) {
        const canPrepare = prepare(config, line, char) !== null;
        const hasEdits = rename(config, line, char, 'x') !== null;
        expect(canPrepare).toBe(hasEdits);
      }
    });
  });
});
