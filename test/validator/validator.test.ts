import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

function validate(text: string, version = '3.1'): Diagnostic[] {
  const doc = parser.parse(text, 'test://validate');
  const validator = new ValidationProvider(registry, version);
  return validator.validate(doc) as Diagnostic[];
}

describe('ValidationProvider', () => {
  describe('unknown directives', () => {
    it('reports error for completely unknown directive', () => {
      const diags = validate('backend web\n    notadirective foo\n')
        .filter((d) => d.severity === DiagnosticSeverity.Error);
      expect(diags).toHaveLength(1);
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diags[0]?.message).toMatch(/unknown directive/i);
    });

    it('passes for known directive in correct section', () => {
      const diags = validate('frontend main\n    use_backend web\nbackend web\n    balance roundrobin\n');
      expect(diags).toHaveLength(0);
    });
  });

  describe('section validation', () => {
    it('reports error for directive used in wrong section', () => {
      // use_backend is valid in frontend, not backend
      const diags = validate('backend web\n    use_backend other\n');
      const sectionErrors = diags.filter((d) => d.message.includes('not valid in'));
      expect(sectionErrors.length).toBeGreaterThan(0);
    });

    it('allows directive in all its valid sections', () => {
      const configs = [
        'defaults\n    balance roundrobin\n',
        'backend web\n    balance roundrobin\n',
        'listen stats\n    balance roundrobin\n',
      ];
      for (const cfg of configs) {
        const diags = validate(cfg);
        const balanceDiags = diags.filter((d) => d.message.includes('balance'));
        expect(balanceDiags).toHaveLength(0);
      }
    });
  });

  describe('HAProxy 2.4 removed directives', () => {
    it('reports error for reqrep in 2.4 (removed)', () => {
      const diags = validate(
        'frontend http-in\n    mode http\n    reqrep ^Host:\\ (.*)\\.test Host:\\ \\1.prod\n',
        '2.4'
      );
      const reqrepErrors = diags.filter((d) => d.message.includes('reqrep'));
      expect(reqrepErrors.length).toBeGreaterThan(0);
      expect(reqrepErrors[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    it('reports error for rsprep in 2.4 (removed)', () => {
      const diags = validate('backend web\n    mode http\n    rsprep ^X-Powered-By:\\ .* X-Powered-By:\\ HAProxy\n', '2.4');
      const rsprepErrors = diags.filter((d) => d.message.includes('rsprep'));
      expect(rsprepErrors.length).toBeGreaterThan(0);
    });
  });

  describe('mode compatibility', () => {
    it('reports error for http-only directive in tcp mode section', () => {
      const text = [
        'frontend tcp-in',
        '    mode tcp',
        '    http-request set-header X-Test value',
      ].join('\n');
      const diags = validate(text);
      const modeErrors = diags.filter((d) => d.message.includes('HTTP mode'));
      expect(modeErrors.length).toBeGreaterThan(0);
    });

    it('allows http-request in http mode section', () => {
      const text = [
        'frontend http-in',
        '    mode http',
        '    http-request set-header X-Test value',
      ].join('\n');
      const diags = validate(text);
      const modeErrors = diags.filter((d) => d.message.includes('HTTP mode'));
      expect(modeErrors).toHaveLength(0);
    });

    it('reports error for tcp-only directive in http mode section', () => {
      // persist rdp-cookie is tcpOnly
      const text = [
        'backend web',
        '    mode http',
        '    persist rdp-cookie',
      ].join('\n');
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('TCP mode'))).toBe(true);
    });
  });

  describe('deprecated directives', () => {
    it('emits warning for a deprecated directive', () => {
      // option httpclose was deprecated in 1.5
      const text = 'backend web\n    mode http\n    option httpclose\n';
      const diags = validate(text);
      const warnings = diags.filter(
        (d) => d.severity === DiagnosticSeverity.Warning && d.message.includes('deprecated')
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]?.message).toMatch(/httpclose/);
    });

    it('emits warning for a deprecated action', () => {
      // set-mark was deprecated in 2.6
      const text = 'frontend http\n    http-request set-mark 0x1\n';
      const diags = validate(text);
      const warnings = diags.filter(
        (d) => d.severity === DiagnosticSeverity.Warning && d.message.includes('set-mark')
      );
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('parse errors surface as diagnostics', () => {
    it('surfaces parse error for directive outside section', () => {
      const diags = validate('daemon\n');
      expect(diags).toHaveLength(1);
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diags[0]?.message).toMatch(/outside of any section/);
    });
  });

  describe('max diagnostics cap', () => {
    it('returns at most 100 diagnostics', () => {
      const lines = ['backend web'];
      for (let i = 0; i < 200; i++) {
        lines.push(`    unknowndirective${i} value`);
      }
      const diags = validate(lines.join('\n'));
      expect(diags.length).toBeLessThanOrEqual(100);
    });
  });

  describe('edge cases — no-arg directives and incomplete lines', () => {
    it('handles directive with no arguments (combinedName = null path)', () => {
      // A directive keyword alone with no args uses the plain kwName lookup
      const text = 'backend web\n    unknowndirective\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('unknowndirective'))).toBe(true);
    });

    it('handles use_backend with no backend name argument', () => {
      // use_backend with no args — nameArg is undefined, should be silently skipped
      const text = 'frontend http\n    use_backend\n';
      const diags = validate(text);
      // Should not crash; may report an unknown-directive error but not a cross-ref warning
      expect(() => diags).not.toThrow();
    });

    it('handles http-request with no action argument', () => {
      // http-request alone with no action — actionArg is undefined, no action error
      const text = 'frontend http\n    http-request\n';
      const diags = validate(text);
      // No action error — only possibly a section/mode diagnostic
      expect(diags.filter((d) => d.message.includes('Unknown http-request action'))).toHaveLength(0);
    });
  });

  describe('version fallback', () => {
    it('falls back to nearest lower version for unknown version string', () => {
      // 3.5 is unknown — should resolve to 3.1 (nearest lower)
      const diags = validate('frontend main\n    use_backend web\nbackend web\n    balance roundrobin\n', '3.5');
      expect(diags).toHaveLength(0);
    });

    it('falls back to oldest known version when version is older than all known', () => {
      // 1.0 is older than 2.4 (our oldest known) — should resolve to 2.4
      const diags = validate('frontend main\n    use_backend web\nbackend web\n    balance roundrobin\n', '1.0');
      expect(diags).toHaveLength(0);
    });
  });

  describe('action sub-keyword validation — http-request/response', () => {
    it('reports error for unknown http-request action', () => {
      const text = 'frontend http\n    http-request unknown-action\n';
      const diags = validate(text);
      const actionErrors = diags.filter((d) => d.message.includes('unknown-action'));
      expect(actionErrors).toHaveLength(1);
      expect(actionErrors[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    it('passes for valid http-request deny action', () => {
      const text = 'frontend http\n    http-request deny\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('deny'))).toHaveLength(0);
    });

    it('passes for valid http-request set-header action', () => {
      const text = 'frontend http\n    http-request set-header X-Test value\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('set-header'))).toHaveLength(0);
    });

    it('reports error for action not valid in http-response', () => {
      // auth is httpReq only
      const text = 'backend web\n    http-response auth\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('auth') && d.message.includes('not a valid'))).toBe(true);
    });

    it('passes for valid http-response set-header action', () => {
      const text = 'backend web\n    http-response set-header X-Test value\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('set-header'))).toHaveLength(0);
    });

    it('reports error for unknown http-after-response action', () => {
      const text = 'backend web\n    http-after-response fake-action\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('fake-action'))).toBe(true);
    });

    it('passes for valid http-after-response set-header action', () => {
      const text = 'backend web\n    http-after-response set-header X-Via proxy\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('set-header'))).toHaveLength(0);
    });

    it('handles parenthesised action names (set-var)', () => {
      // set-var(my_var) should be stripped to set-var for lookup
      const text = 'frontend http\n    http-request set-var(txn.user) req.cook(user)\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('set-var'))).toHaveLength(0);
    });
  });

  describe('action sub-keyword validation — tcp-request/response', () => {
    it('reports error for unknown tcp-request connection action', () => {
      const text = 'frontend tcp\n    tcp-request connection not-an-action\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('not-an-action'))).toBe(true);
    });

    it('passes for valid tcp-request connection accept', () => {
      const text = 'frontend tcp\n    tcp-request connection accept\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('accept'))).toHaveLength(0);
    });

    it('passes for valid tcp-request connection reject', () => {
      const text = 'frontend tcp\n    tcp-request connection reject\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('reject'))).toHaveLength(0);
    });

    it('reports error for action not valid in tcp-request connection', () => {
      // set-header is httpReq only
      const text = 'frontend tcp\n    tcp-request connection set-header X-Test val\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('set-header') && d.message.includes('not a valid'))).toBe(true);
    });

    it('passes for valid tcp-request content set-var', () => {
      const text = 'frontend tcp\n    tcp-request content set-var(txn.x) int(1)\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('set-var'))).toHaveLength(0);
    });

    it('passes for valid tcp-response content set-var', () => {
      const text = 'backend web\n    tcp-response content set-var(txn.y) int(2)\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('set-var'))).toHaveLength(0);
    });

    it('passes for tcp-request inspect-delay (no action to validate)', () => {
      const text = 'frontend tcp\n    tcp-request inspect-delay 5s\n';
      const diags = validate(text);
      expect(diags).toHaveLength(0);
    });
  });

  describe('compound directive resolution', () => {
    it('resolves option httplog as a known directive', () => {
      const text = 'frontend http\n    option httplog\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('Unknown directive'))).toHaveLength(0);
    });

    it('reports error for unknown option variant', () => {
      const text = 'backend web\n    option not-a-real-option\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('Unknown directive'))).toBe(true);
    });

    it('resolves tcp-request connection as a known directive', () => {
      const text = 'frontend tcp\n    tcp-request connection accept\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('Unknown directive'))).toHaveLength(0);
    });
  });

  describe('cross-reference validation — use_backend / default_backend', () => {
    it('passes when use_backend references a defined backend', () => {
      const text = [
        'frontend http',
        '    use_backend web',
        'backend web',
        '    balance roundrobin',
      ].join('\n');
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('web'))).toHaveLength(0);
    });

    it('warns when use_backend references an undefined backend', () => {
      const text = 'frontend http\n    use_backend missing\n';
      const diags = validate(text);
      const ref = diags.filter((d) => d.message.includes('missing'));
      expect(ref).toHaveLength(1);
      expect(ref[0]?.severity).toBe(DiagnosticSeverity.Warning);
    });

    it('warns when default_backend references an undefined backend', () => {
      const text = 'frontend http\n    default_backend fallback\n';
      const diags = validate(text);
      expect(diags.some((d) => d.message.includes('fallback'))).toBe(true);
    });

    it('passes when use_backend references a listen section', () => {
      const text = [
        'frontend http',
        '    use_backend stats-listener',
        'listen stats-listener',
        '    bind *:8404',
      ].join('\n');
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('stats-listener'))).toHaveLength(0);
    });

    it('reports multiple missing backend references independently', () => {
      const text = [
        'frontend http',
        '    use_backend ghost1',
        '    default_backend ghost2',
      ].join('\n');
      const diags = validate(text);
      const refs = diags.filter((d) => d.message.includes('ghost'));
      expect(refs).toHaveLength(2);
    });

    it('skips dynamic backend selection using format expressions', () => {
      const text = 'frontend http\n    use_backend %[req.cook(SERVERID)]\n';
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('use_backend'))).toHaveLength(0);
    });

    it('is case-insensitive for backend name matching', () => {
      const text = [
        'frontend http',
        '    use_backend Web',
        'backend web',
        '    balance roundrobin',
      ].join('\n');
      const diags = validate(text);
      expect(diags.filter((d) => d.message.includes('Web'))).toHaveLength(0);
    });

    it('passes with multiple backends all referenced correctly', () => {
      const text = [
        'frontend http',
        '    use_backend api',
        '    default_backend web',
        'backend api',
        '    server s1 10.0.0.1:80',
        'backend web',
        '    server s2 10.0.0.2:80',
      ].join('\n');
      const diags = validate(text);
      const refDiags = diags.filter((d) =>
        d.message.includes('api') || d.message.includes('web')
      );
      expect(refDiags).toHaveLength(0);
    });
  });

  describe('special sections — no false positives', () => {
    it('peers section: peer directive is valid', () => {
      const text = 'peers haproxy-peers\n    peer node1 10.0.0.1:1024\n';
      const diags = validate(text).filter((d) => d.message.includes('peer'));
      expect(diags).toHaveLength(0);
    });

    it('peers section: server directive is valid', () => {
      const text = 'peers haproxy-peers\n    server node1 10.0.0.1:1024\n';
      expect(validate(text).filter((d) => d.message.toLowerCase().includes('unknown'))).toHaveLength(0);
    });

    it('resolvers section: nameserver directive is valid', () => {
      const text = 'resolvers dns\n    nameserver ns1 8.8.8.8:53\n';
      expect(validate(text).filter((d) => d.message.includes('nameserver'))).toHaveLength(0);
    });

    it('resolvers section: hold and timeout directives are valid', () => {
      const text = [
        'resolvers dns',
        '    nameserver ns1 8.8.8.8:53',
        '    timeout retry 1s',
        '    hold valid 10s',
      ].join('\n');
      expect(validate(text).filter((d) => d.message.toLowerCase().includes('unknown'))).toHaveLength(0);
    });

    it('userlist section: user and group directives are valid', () => {
      const text = [
        'userlist admins',
        '    user alice password $6$salt$hash groups admin',
        '    group admin users alice',
      ].join('\n');
      expect(validate(text).filter((d) => d.message.toLowerCase().includes('unknown'))).toHaveLength(0);
    });

    it('mailers section: mailer directive is valid', () => {
      const text = 'mailers smtp\n    mailer relay1 10.0.0.1:25\n';
      expect(validate(text).filter((d) => d.message.includes('mailer'))).toHaveLength(0);
    });

    it('ring section: server and maxlen are valid', () => {
      const text = [
        'ring myring',
        '    maxlen 1024',
        '    server loghost 10.0.0.1:514',
      ].join('\n');
      expect(validate(text).filter((d) => d.message.toLowerCase().includes('unknown'))).toHaveLength(0);
    });

    it('cache section: total-max-size and max-age are valid', () => {
      const text = 'cache webcache\n    total-max-size 64\n    max-age 3600\n';
      expect(validate(text).filter((d) => d.message.toLowerCase().includes('unknown'))).toHaveLength(0);
    });

    it('program section: command is valid', () => {
      const text = 'program agent\n    command /usr/bin/haproxy-agent\n';
      expect(validate(text).filter((d) => d.message.includes('command'))).toHaveLength(0);
    });

    it('http-errors section: errorfile is valid', () => {
      const text = 'http-errors myerrors\n    errorfile 503 /etc/haproxy/errors/503.http\n';
      expect(validate(text).filter((d) => d.message.includes('errorfile'))).toHaveLength(0);
    });

    it('log-forward section: dgram-bind and log are valid', () => {
      const text = [
        'log-forward syslog-fwd',
        '    dgram-bind 127.0.0.1:514',
        '    log 10.0.0.1:514 local0',
      ].join('\n');
      expect(validate(text).filter((d) => d.message.toLowerCase().includes('unknown'))).toHaveLength(0);
    });
  });

  describe('per-version validation — HAProxy 2.4', () => {
    const v = '2.4';

    it('accepts balance roundrobin (valid since 1.0)', () => {
      expect(validate('frontend main\n    use_backend web\nbackend web\n    balance roundrobin\n', v)).toHaveLength(0);
    });

    it('errors on reqrep (removed in 2.4)', () => {
      const d = validate('frontend http\n    reqrep ^Host:\\ (.*) Host:\\ \\1\n', v)
        .filter((diag) => diag.message.includes('reqrep'));
      expect(d.length).toBeGreaterThan(0);
      expect(d[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    it('errors on rsprep (removed in 2.4)', () => {
      const d = validate('backend web\n    rsprep ^Server:\\ .* Server:\\ HAProxy\n', v)
        .filter((diag) => diag.message.includes('rsprep'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('set-mark action has no deprecation warning in 2.4 (deprecated since 2.6)', () => {
      const d = validate('frontend http\n    http-request set-mark 0x1\n', v)
        .filter((diag) => diag.severity === DiagnosticSeverity.Warning && diag.message.includes('set-mark'));
      expect(d).toHaveLength(0);
    });

    it('option httpclose emits deprecation warning (deprecated since 1.5)', () => {
      const d = validate('backend web\n    option httpclose\n', v)
        .filter((diag) => diag.severity === DiagnosticSeverity.Warning);
      expect(d.length).toBeGreaterThan(0);
    });
  });

  describe('per-version validation — HAProxy 2.6', () => {
    const v = '2.6';

    it('accepts balance roundrobin', () => {
      expect(validate('frontend main\n    use_backend web\nbackend web\n    balance roundrobin\n', v)).toHaveLength(0);
    });

    it('errors on reqrep (still removed in 2.6)', () => {
      const d = validate('frontend http\n    reqrep ^Host:\\ (.*) Host:\\ \\1\n', v)
        .filter((diag) => diag.message.includes('reqrep'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('set-mark action emits deprecation warning (deprecated since 2.6)', () => {
      const d = validate('frontend http\n    http-request set-mark 0x1\n', v)
        .filter((diag) => diag.severity === DiagnosticSeverity.Warning && diag.message.includes('set-mark'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('set-tos action emits deprecation warning (deprecated since 2.6)', () => {
      const d = validate('frontend http\n    http-request set-tos 0x10\n', v)
        .filter((diag) => diag.severity === DiagnosticSeverity.Warning && diag.message.includes('set-tos'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('valid http-request deny has no errors', () => {
      expect(validate('frontend http\n    http-request deny\n', v)
        .filter((d) => d.message.includes('deny'))).toHaveLength(0);
    });
  });

  describe('per-version validation — HAProxy 2.8', () => {
    const v = '2.8';

    it('accepts known directives', () => {
      expect(validate('frontend main\n    use_backend web\nbackend web\n    balance leastconn\n', v)).toHaveLength(0);
    });

    it('errors on reqrep (still removed in 2.8)', () => {
      const d = validate('frontend http\n    reqrep ^Host:\\ (.*) Host:\\ \\1\n', v)
        .filter((diag) => diag.message.includes('reqrep'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('set-mark action still emits deprecation warning in 2.8', () => {
      const d = validate('frontend http\n    http-request set-mark 0x1\n', v)
        .filter((diag) => diag.severity === DiagnosticSeverity.Warning);
      expect(d.length).toBeGreaterThan(0);
    });

    it('cross-reference validation works in 2.8', () => {
      const text = 'frontend http\n    use_backend missing\n';
      const d = validate(text, v).filter((diag) => diag.message.includes('missing'));
      expect(d).toHaveLength(1);
      expect(d[0]?.severity).toBe(DiagnosticSeverity.Warning);
    });
  });

  describe('per-version validation — HAProxy 3.0', () => {
    const v = '3.0';

    it('accepts known directives', () => {
      expect(validate('frontend main\n    use_backend web\nbackend web\n    balance source\n', v)).toHaveLength(0);
    });

    it('errors on unknown directive', () => {
      const d = validate('backend web\n    notreal foo\n', v)
        .filter((diag) => diag.message.toLowerCase().includes('unknown'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('mode http + http-request works in 3.0', () => {
      const text = 'frontend http\n    mode http\n    http-request deny\n';
      expect(validate(text, v).filter((d) => d.message.includes('HTTP mode'))).toHaveLength(0);
    });
  });

  describe('per-version validation — HAProxy 3.1 (default)', () => {
    it('accepts balance roundrobin', () => {
      expect(validate('frontend main\n    use_backend web\nbackend web\n    balance roundrobin\n')).toHaveLength(0);
    });

    it('errors on reqrep (removed since 2.4)', () => {
      const d = validate('frontend http\n    reqrep ^Host:\\ (.*) Host:\\ \\1\n')
        .filter((diag) => diag.message.includes('reqrep'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('set-mark action emits deprecation warning in 3.1', () => {
      const d = validate('frontend http\n    http-request set-mark 0x1\n')
        .filter((diag) => diag.severity === DiagnosticSeverity.Warning);
      expect(d.length).toBeGreaterThan(0);
    });

    it('section validation works in 3.1', () => {
      const d = validate('backend web\n    use_backend other\n')
        .filter((diag) => diag.message.includes('not valid in'));
      expect(d.length).toBeGreaterThan(0);
    });

    it('cross-reference warning in 3.1', () => {
      const d = validate('frontend http\n    use_backend ghost\n')
        .filter((diag) => diag.message.includes('ghost'));
      expect(d).toHaveLength(1);
    });
  });
});
