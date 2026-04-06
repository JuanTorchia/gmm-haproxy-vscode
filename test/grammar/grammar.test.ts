/**
 * Structural tests for the HAProxy TextMate grammar.
 *
 * These tests verify:
 *  1. The grammar JSON is valid and well-formed
 *  2. All scope names match the spec defined in CLAUDE.md
 *  3. All regex patterns compile without errors
 *  4. Key patterns are present and apply the correct scopes
 *  5. No required patterns are missing
 *
 * Note: Full tokenization snapshot tests require vscode-textmate
 * (a separate devDependency). These structural tests catch the most
 * common regressions without that dependency.
 */

import * as fs from 'fs';
import * as path from 'path';

const GRAMMAR_PATH = path.resolve(__dirname, '../../syntaxes/haproxy.tmLanguage.json');

// Load and parse the grammar once for all tests
const raw = fs.readFileSync(GRAMMAR_PATH, 'utf-8');
const grammar: any = JSON.parse(raw);

// ── Structural integrity ────────────────────────────────────────────────────

describe('HAProxy grammar — structural integrity', () => {
  it('is valid JSON', () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('has required top-level fields', () => {
    expect(grammar.scopeName).toBe('source.haproxy');
    expect(grammar.name).toBe('HAProxy');
    expect(Array.isArray(grammar.patterns)).toBe(true);
    expect(typeof grammar.repository).toBe('object');
  });

  it('declares .cfg and .conf file types', () => {
    expect(grammar.fileTypes).toContain('cfg');
    expect(grammar.fileTypes).toContain('conf');
  });

  it('all top-level pattern includes reference existing repository keys', () => {
    const repoKeys = new Set(Object.keys(grammar.repository));
    for (const p of grammar.patterns) {
      if (p.include?.startsWith('#')) {
        const key = p.include.slice(1);
        expect(repoKeys.has(key)).toBe(true);
      }
    }
  });
});

// ── Scope name compliance (CLAUDE.md spec) ─────────────────────────────────

describe('HAProxy grammar — scope names match CLAUDE.md spec', () => {
  /** Collect all "name" values from a grammar node recursively. */
  function collectScopes(node: any): string[] {
    const scopes: string[] = [];
    if (!node || typeof node !== 'object') return scopes;

    if (typeof node.name === 'string') scopes.push(node.name);

    if (node.captures) {
      for (const cap of Object.values(node.captures)) {
        scopes.push(...collectScopes(cap));
      }
    }
    if (Array.isArray(node.patterns)) {
      for (const p of node.patterns) scopes.push(...collectScopes(p));
    }
    if (node.repository) {
      for (const rule of Object.values(node.repository)) {
        scopes.push(...collectScopes(rule));
      }
    }
    return scopes;
  }

  const allScopes = collectScopes(grammar);

  it('uses entity.name.section.haproxy for section headers', () => {
    expect(allScopes).toContain('entity.name.section.haproxy');
  });

  it('uses keyword.other.directive.haproxy for directive keywords', () => {
    expect(allScopes).toContain('keyword.other.directive.haproxy');
  });

  it('uses keyword.control.haproxy for option/http-request/tcp-request keywords', () => {
    expect(allScopes).toContain('keyword.control.haproxy');
  });

  it('uses entity.name.label.haproxy for ACL names', () => {
    expect(allScopes).toContain('entity.name.label.haproxy');
  });

  it('uses entity.name.function.haproxy for backend references', () => {
    expect(allScopes).toContain('entity.name.function.haproxy');
  });

  it('uses comment.line.number-sign.haproxy for comments', () => {
    expect(allScopes).toContain('comment.line.number-sign.haproxy');
  });

  it('uses string.quoted.double.haproxy for double-quoted strings', () => {
    expect(allScopes).toContain('string.quoted.double.haproxy');
  });

  it('uses string.quoted.single.haproxy for single-quoted strings', () => {
    expect(allScopes).toContain('string.quoted.single.haproxy');
  });

  it('uses constant.numeric.ip.haproxy for IP addresses', () => {
    expect(allScopes).toContain('constant.numeric.ip.haproxy');
  });

  it('uses constant.numeric.port.haproxy for port numbers', () => {
    expect(allScopes).toContain('constant.numeric.port.haproxy');
  });

  it('uses constant.numeric.timeout.haproxy for timeout values', () => {
    expect(allScopes).toContain('constant.numeric.timeout.haproxy');
  });
});

// ── Required repository rules ──────────────────────────────────────────────

describe('HAProxy grammar — required repository rules present', () => {
  const REQUIRED_RULES = [
    'comment',
    'section-header',
    'http-rule-directive',
    'tcp-rule-directive',
    'acl-directive',
    'option-directive',
    'mode-directive',
    'balance-directive',
    'backend-reference',
    'server-directive',
    'bind-directive',
    'condition-keyword',
    'timeout-directive',
    'format-expression',
    'string-value',
    'ip-address',
    'port-number',
    'generic-directive',
  ];

  for (const rule of REQUIRED_RULES) {
    it(`has repository rule: ${rule}`, () => {
      expect(grammar.repository).toHaveProperty(rule);
    });
  }
});

// ── Regex compilation ──────────────────────────────────────────────────────

describe('HAProxy grammar — all regex patterns compile', () => {
  function collectPatterns(node: any): string[] {
    const patterns: string[] = [];
    if (!node || typeof node !== 'object') return patterns;

    if (typeof node.match === 'string') patterns.push(node.match);
    if (typeof node.begin === 'string') patterns.push(node.begin);
    if (typeof node.end === 'string') patterns.push(node.end);

    if (node.captures) {
      for (const cap of Object.values(node.captures)) patterns.push(...collectPatterns(cap));
    }
    if (Array.isArray(node.patterns)) {
      for (const p of node.patterns) patterns.push(...collectPatterns(p));
    }
    if (node.repository) {
      for (const rule of Object.values(node.repository)) patterns.push(...collectPatterns(rule));
    }
    return patterns;
  }

  const allPatterns = collectPatterns(grammar);

  it('has at least 10 regex patterns', () => {
    expect(allPatterns.length).toBeGreaterThanOrEqual(10);
  });

  for (let i = 0; i < allPatterns.length; i++) {
    const pattern = allPatterns[i] as string;
    it(`pattern[${i}] compiles: ${pattern.slice(0, 60)}`, () => {
      expect(() => new RegExp(pattern)).not.toThrow();
    });
  }
});

// ── Key pattern spot-checks ────────────────────────────────────────────────

describe('HAProxy grammar — key pattern spot-checks', () => {
  it('comment pattern matches # lines', () => {
    const rule = grammar.repository['comment'];
    const re = new RegExp(rule.match);
    expect(re.test('# this is a comment')).toBe(true);
    expect(re.test('    balance roundrobin # inline comment')).toBe(true);
  });

  it('section-header matches all standard section types', () => {
    const rule = grammar.repository['section-header'];
    const re = new RegExp(rule.match);
    for (const kw of ['global', 'defaults', 'frontend', 'backend', 'listen',
                       'userlist', 'peers', 'resolvers', 'mailers', 'ring',
                       'log-forward', 'program', 'http-errors', 'cache']) {
      expect(re.test(kw)).toBe(true);
    }
  });

  it('section-header captures section name', () => {
    const rule = grammar.repository['section-header'];
    const re = new RegExp(rule.match);
    const m = 'frontend http-in'.match(re);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe('frontend');
    expect(m?.[3]).toBe('http-in');
  });

  it('http-rule-directive matches http-request actions', () => {
    const rule = grammar.repository['http-rule-directive'];
    const re = new RegExp(rule.match);
    expect(re.test('    http-request deny')).toBe(true);
    expect(re.test('    http-response set-header')).toBe(true);
    expect(re.test('    http-after-response set-var')).toBe(true);
  });

  it('http-rule-directive captures keyword and action', () => {
    const rule = grammar.repository['http-rule-directive'];
    const re = new RegExp(rule.match);
    const m = '    http-request deny if METH_POST'.match(re);
    expect(m?.[1]).toBe('http-request');
    expect(m?.[2]).toBe('deny');
  });

  it('tcp-rule-directive matches tcp-request sub-types', () => {
    const rule = grammar.repository['tcp-rule-directive'];
    const re = new RegExp(rule.match);
    expect(re.test('    tcp-request connection accept')).toBe(true);
    expect(re.test('    tcp-request content set-var')).toBe(true);
    expect(re.test('    tcp-response content allow')).toBe(true);
    // inspect-delay should NOT match tcp-rule-directive (has no action)
    expect(re.test('    tcp-request inspect-delay 5s')).toBe(false);
  });

  it('acl-directive captures acl name and criterion', () => {
    const rule = grammar.repository['acl-directive'];
    const re = new RegExp(rule.match);
    const m = '    acl is_local src'.match(re);
    expect(m?.[1]).toBe('acl');
    expect(m?.[2]).toBe('is_local');
    expect(m?.[3]).toBe('src');
  });

  it('acl-directive captures criterion with parentheses', () => {
    const rule = grammar.repository['acl-directive'];
    const re = new RegExp(rule.match);
    const m = '    acl is_api hdr(host)'.match(re);
    expect(m?.[3]).toBe('hdr(host)');
  });

  it('option-directive captures option name', () => {
    const rule = grammar.repository['option-directive'];
    const re = new RegExp(rule.match);
    const m = '    option httplog'.match(re);
    expect(m?.[2]).toBe('option');
    expect(m?.[3]).toBe('httplog');
  });

  it('option-directive captures "no" prefix', () => {
    const rule = grammar.repository['option-directive'];
    const re = new RegExp(rule.match);
    const m = '    no option http-server-close'.match(re);
    expect(m?.[1]).toBe('no');
    expect(m?.[3]).toBe('http-server-close');
  });

  it('mode-directive captures http and tcp values', () => {
    const rule = grammar.repository['mode-directive'];
    const re = new RegExp(rule.match);
    expect(re.test('    mode http')).toBe(true);
    expect(re.test('    mode tcp')).toBe(true);
    expect(re.test('    mode other')).toBe(false);
  });

  it('balance-directive captures algorithm', () => {
    const rule = grammar.repository['balance-directive'];
    const re = new RegExp(rule.match);
    const m = '    balance roundrobin'.match(re);
    expect(m?.[2]).toBe('roundrobin');
  });

  it('backend-reference captures backend name', () => {
    const rule = grammar.repository['backend-reference'];
    const re = new RegExp(rule.match);
    const m = '    use_backend web-backend'.match(re);
    expect(m?.[1]).toBe('use_backend');
    expect(m?.[2]).toBe('web-backend');
  });

  it('timeout-directive matches timeout values with units', () => {
    const rule = grammar.repository['timeout-directive'];
    const re = new RegExp(rule.match);
    expect(re.test('5s')).toBe(true);
    expect(re.test('30m')).toBe(true);
    expect(re.test('500ms')).toBe(true);
    expect(re.test('1h')).toBe(true);
    expect(re.test('7d')).toBe(true);
  });

  it('format-expression matches HAProxy fetch expressions', () => {
    const rule = grammar.repository['format-expression'];
    const re = new RegExp(rule.match);
    expect(re.test('%[src]')).toBe(true);
    expect(re.test('%[hdr(host)]')).toBe(true);
    expect(re.test('%{+Q}[hdr(host)]')).toBe(true);
  });

  it('ip-address captures IPv4 and optional port', () => {
    const rule = grammar.repository['ip-address'];
    const re = new RegExp(rule.match);
    expect(re.test('10.0.0.1')).toBe(true);
    expect(re.test('192.168.1.100:8080')).toBe(true);
  });

  it('condition-keyword matches if and unless', () => {
    const rule = grammar.repository['condition-keyword'];
    const re = new RegExp(rule.match);
    expect(re.test('if')).toBe(true);
    expect(re.test('unless')).toBe(true);
  });
});
