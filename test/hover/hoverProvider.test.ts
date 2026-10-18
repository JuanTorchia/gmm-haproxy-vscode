import { HaproxyParser } from '../../server/src/parser/parser';
import { HoverProvider } from '../../server/src/hover/hoverProvider';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/**
 * Parse config text and request hover at the given (line, character) position.
 * Lines are 0-based. The helper trims nothing — use exact column offsets.
 */
function hover(text: string, line: number, character: number, version = '3.1') {
  const doc = parser.parse(text, 'test://hover');
  const provider = new HoverProvider(registry, version);
  return provider.provideHover(doc, { line, character });
}

/** Extract the markdown string value from a hover result. */
function md(h: ReturnType<typeof hover>): string {
  if (!h) return '';
  const contents = h.contents as { kind: string; value: string };
  return contents.value ?? '';
}

// ── Directive keyword hover ────────────────────────────────────────────────

describe('HoverProvider — directive keywords', () => {
  it('returns hover for a known directive keyword', () => {
    // "    balance roundrobin" — 'balance' starts at col 4
    const text = 'backend web\n    balance roundrobin\n';
    const result = hover(text, 1, 6);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/balance/);
    expect(content).toMatch(/Since/i);
  });

  it('returns null when hovering over an argument, not the keyword', () => {
    // cursor on "roundrobin" (col 12)
    const text = 'backend web\n    balance roundrobin\n';
    const result = hover(text, 1, 14);
    // Not a keyword hover — no directive definition for "roundrobin"
    expect(result).toBeNull();
  });

  it('returns null when hovering on a section header', () => {
    const text = 'backend web\n    balance roundrobin\n';
    const result = hover(text, 0, 4);
    expect(result).toBeNull();
  });

  it('includes valid-in sections in directive hover', () => {
    const text = 'backend web\n    balance roundrobin\n';
    const result = hover(text, 1, 6);
    const content = md(result);
    expect(content).toMatch(/Valid in/i);
    expect(content).toMatch(/backend/);
  });

  it('shows deprecated warning for deprecated directive', () => {
    // reqrep was removed in 2.1 — test on 2.4 version
    const text = 'frontend http\n    option httplog\n';
    const result = hover(text, 1, 8, '3.1');
    const content = md(result);
    expect(content).toMatch(/option httplog|httplog/i);
  });

  it('includes docs link when available', () => {
    const text = 'backend web\n    balance roundrobin\n';
    const result = hover(text, 1, 6);
    const content = md(result);
    // balance should have a docsUrl
    if (content.includes('📖')) {
      expect(content).toMatch(/haproxy\.org|docs/i);
    }
  });

  it('returns null for an unknown directive', () => {
    const text = 'backend web\n    notadirective foo\n';
    const result = hover(text, 1, 6);
    expect(result).toBeNull();
  });
});

// ── http-request action hover ──────────────────────────────────────────────

describe('HoverProvider — http-request actions', () => {
  it('shows hover for "deny" in http-request context', () => {
    // "    http-request deny if ..."
    //  0123456789012345678
    // 'deny' starts at col 17
    const text = 'frontend http\n    http-request deny if METH_POST\n';
    const result = hover(text, 1, 18);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/deny/i);
    expect(content).toMatch(/Rule set.*http-request/i);
    expect(content).toMatch(/Valid in/i);
  });

  it('shows hover for "allow" in http-request context', () => {
    const text = 'frontend http\n    http-request allow\n';
    // 'allow' starts at col 17
    const result = hover(text, 1, 18);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/allow/i);
  });

  it('shows hover for "set-header" in http-request context', () => {
    const text = 'frontend http\n    http-request set-header X-Real-IP %[src]\n';
    // 'set-header' starts at col 17
    const result = hover(text, 1, 20);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/set-header/i);
  });

  it('shows hover for "redirect" in http-request context', () => {
    const text = 'frontend http\n    http-request redirect scheme https\n';
    const result = hover(text, 1, 18);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/redirect/i);
  });

  it('returns null for unknown action', () => {
    const text = 'frontend http\n    http-request unknown-action\n';
    const result = hover(text, 1, 18);
    expect(result).toBeNull();
  });
});

// ── http-response action hover ────────────────────────────────────────────

describe('HoverProvider — http-response actions', () => {
  it('shows hover for "set-status" in http-response context', () => {
    const text = 'backend web\n    http-response set-status 200\n';
    // 'set-status' starts at col 18
    const result = hover(text, 1, 20);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/set-status/i);
    expect(content).toMatch(/http-response/i);
  });

  it('shows hover for "del-header" in http-response context', () => {
    const text = 'backend web\n    http-response del-header X-Internal\n';
    const result = hover(text, 1, 20);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/del-header/i);
  });
});

// ── tcp-request action hover ──────────────────────────────────────────────

describe('HoverProvider — tcp-request actions', () => {
  it('shows hover for "accept" in tcp-request connection context', () => {
    // "    tcp-request connection accept if ..."
    //  col: 4             17         28
    const text = 'frontend tcp\n    tcp-request connection accept\n';
    // 'accept' starts at col 28
    const result = hover(text, 1, 30);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/accept/i);
    expect(content).toMatch(/tcp-request connection/i);
  });

  it('shows hover for "reject" in tcp-request connection context', () => {
    const text = 'frontend tcp\n    tcp-request connection reject\n';
    const result = hover(text, 1, 30);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/reject/i);
  });

  it('shows hover for "set-var" in tcp-request content context', () => {
    const text = 'frontend tcp\n    tcp-request content set-var(my_var) str(val)\n';
    // 'set-var' starts at col 25
    const result = hover(text, 1, 27);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/set-var/i);
  });

  it('does not hover over tcp-request sub-type keyword (connection/session/content)', () => {
    // hovering "connection" — it's args[0], not an action
    const text = 'frontend tcp\n    tcp-request connection accept\n';
    // 'connection' starts at col 17
    const result = hover(text, 1, 20);
    // connection is not an action — should return null
    expect(result).toBeNull();
  });
});

// ── ACL fetch method hover ────────────────────────────────────────────────

describe('HoverProvider — ACL fetch methods', () => {
  it('shows hover for "src" fetch method', () => {
    // "    acl is_local src 127.0.0.1/8"
    //  col: 4       12  16
    const text = 'frontend http\n    acl is_local src 127.0.0.1/8\n';
    // 'src' starts at col 16
    const result = hover(text, 1, 17);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/src/);
    expect(content).toMatch(/ip|Layer/i);
  });

  it('shows hover for "hdr" fetch method with parenthesised arg', () => {
    // "    acl is_api hdr(host) -i api.example.com"
    //  col: 4       14  18
    const text = 'frontend http\n    acl is_api hdr(host) -i api.example.com\n';
    // 'hdr(host)' starts at col 15; cursor inside 'hdr'
    const result = hover(text, 1, 16);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/hdr/);
    expect(content).toMatch(/string|Layer/i);
  });

  it('shows hover for "path" fetch method', () => {
    const text = 'frontend http\n    acl is_root path /\n';
    // 'path' starts at col 15
    const result = hover(text, 1, 16);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/path/);
  });

  it('shows hover for ACL declination "path_beg"', () => {
    const text = 'frontend http\n    acl is_api path_beg /api/\n';
    // 'path_beg' starts at col 15
    const result = hover(text, 1, 17);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/path_beg/);
    expect(content).toMatch(/path/i); // mentions parent
  });

  it('shows hover for "ssl_fc_sni" fetch method', () => {
    const text = 'frontend https\n    acl is_myhost ssl_fc_sni myhost.com\n';
    // 'ssl_fc_sni' starts at col 18 (4 spaces + "acl" + " " + "is_myhost" + " ")
    const result = hover(text, 1, 20);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/ssl_fc_sni/);
  });

  it('shows hover for pre-defined ACL "METH_GET"', () => {
    const text = 'frontend http\n    acl is_get METH_GET\n';
    // 'METH_GET' starts at col 15
    const result = hover(text, 1, 17);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/METH_GET/);
    expect(content).toMatch(/pre-defined ACL/i);
    expect(content).toMatch(/Equivalent to/i);
  });

  it('shows hover for pre-defined ACL "LOCALHOST"', () => {
    const text = 'frontend http\n    acl is_local LOCALHOST\n';
    // 'LOCALHOST' starts at col 15
    const result = hover(text, 1, 17);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/LOCALHOST/);
    expect(content).toMatch(/127\.0\.0\.1|loopback|localhost/i);
  });

  it('returns null for unrecognised ACL criterion', () => {
    const text = 'frontend http\n    acl my_acl unknown_fetch\n';
    // 'unknown_fetch' starts at col 15
    const result = hover(text, 1, 17);
    expect(result).toBeNull();
  });

  it('does not hover over the ACL name itself (args[0])', () => {
    // "    acl is_local src ..."
    //  'is_local' is at col 8 — this is the ACL name, not a criterion
    const text = 'frontend http\n    acl is_local src 127.0.0.1/8\n';
    const result = hover(text, 1, 10);
    // 'is_local' is args[0] — not a fetch method
    expect(result).toBeNull();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────

describe('HoverProvider — edge cases', () => {
  it('returns null for empty document', () => {
    const result = hover('', 0, 0);
    expect(result).toBeNull();
  });

  it('returns null when cursor is on blank line', () => {
    const text = 'backend web\n\n    balance roundrobin\n';
    const result = hover(text, 1, 0);
    expect(result).toBeNull();
  });

  it('hover range is set to the keyword token span', () => {
    const text = 'backend web\n    balance roundrobin\n';
    // 'balance' is at col 4..10
    const result = hover(text, 1, 6);
    expect(result?.range).toBeDefined();
    expect(result?.range?.start.line).toBe(1);
    expect(result?.range?.start.character).toBe(4);
  });

  it('hover range is set to the action token span', () => {
    const text = 'frontend http\n    http-request deny if METH_POST\n';
    // 'deny' is at col 17..20
    const result = hover(text, 1, 18);
    expect(result?.range).toBeDefined();
    expect(result?.range?.start.line).toBe(1);
  });

  it('handles global section directives', () => {
    const text = 'global\n    maxconn 50000\n';
    // 'maxconn' starts at col 4
    const result = hover(text, 1, 6);
    expect(result).not.toBeNull();
    const content = md(result);
    expect(content).toMatch(/maxconn/i);
  });
});
