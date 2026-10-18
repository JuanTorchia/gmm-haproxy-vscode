import * as fs from 'fs';
import * as path from 'path';
import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

const ARITY_MESSAGE = /^'[^']+' (requires .+; missing: |requires at least |takes (exactly|at most) )/;

/** Diagnostics produced for a config, restricted to argument-count errors. */
function arityDiags(text: string, version = '3.2'): Diagnostic[] {
  const doc = parser.parse(text, 'test://arity');
  const validator = new ValidationProvider(registry, version);
  return (validator.validate(doc) as Diagnostic[]).filter((d) => ARITY_MESSAGE.test(d.message));
}

const inFrontend = (line: string): string => `frontend f\n    ${line}\n`;
const inBackend = (line: string): string => `backend b\n    ${line}\n`;

describe('arity rule', () => {
  describe('missing arguments', () => {
    const cases: ReadonlyArray<readonly [string, (l: string) => string, string]> = [
      ['bind', inFrontend, 'an address'],
      ['default_backend', inFrontend, 'a backend name'],
      ['use_backend', inFrontend, 'a backend name'],
      ['server', inBackend, 'a name and an address'],
      ['server web1', inBackend, 'an address'],
      ['server-template web 1-3', inBackend, 'an address'],
      ['balance', inBackend, 'an algorithm'],
      ['use-server', inBackend, 'a server name'],
      ['acl is_api', inFrontend, 'a criterion'],
      ['mode', inFrontend, 'a mode (tcp, http or log)'],
      ['retries', inBackend, 'a retry count'],
      ['fullconn', inBackend, 'a connection count'],
      ['maxconn', inFrontend, 'a connection count'],
      ['errorfile 503', inBackend, 'a file path'],
      ['cookie', inBackend, 'a cookie name'],
      ['log', inFrontend, "an address or 'global'"],
    ];

    for (const [line, wrap, missing] of cases) {
      it(`reports '${line}' as missing ${missing}`, () => {
        const diags = arityDiags(wrap(line));
        expect(diags).toHaveLength(1);
        expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
        expect(diags[0]?.message).toContain(`missing: ${missing}.`);
      });
    }

    it('names every required argument and shows the usage', () => {
      expect(arityDiags(inBackend('server'))[0]?.message).toBe(
        "'server' requires a name and an address; missing: a name and an address. " +
          'Usage: server <name> <address>[:<port>] [param*]'
      );
    });

    it('underlines the keyword', () => {
      const range = arityDiags(inBackend('balance'))[0]?.range;
      expect(range?.start).toEqual({ line: 1, character: 4 });
      expect(range?.end).toEqual({ line: 1, character: 11 });
    });

    it('checks global maxconn too', () => {
      expect(arityDiags('global\n    maxconn\n')).toHaveLength(1);
    });
  });

  describe('extra arguments on fixed-arity directives', () => {
    it('reports a second backend name on default_backend', () => {
      const diags = arityDiags(inFrontend('default_backend web api'));
      expect(diags).toHaveLength(1);
      expect(diags[0]?.message).toBe(
        "'default_backend' takes exactly 1 argument but got 2. Remove the extra argument. Usage: default_backend <backend>"
      );
    });

    it('underlines the extra arguments only', () => {
      // `    mode http tcp` — the extra `tcp` sits at columns 14-17
      const range = arityDiags(inFrontend('mode http tcp'))[0]?.range;
      expect(range?.start).toEqual({ line: 1, character: 14 });
      expect(range?.end).toEqual({ line: 1, character: 17 });
    });

    it('leaves open-ended directives alone', () => {
      expect(arityDiags(inBackend('server web1 10.0.0.1:80 check inter 2s fall 3 rise 2 weight 10'))).toHaveLength(0);
      expect(arityDiags(inFrontend('use_backend api if { path_beg /api } !is_static'))).toHaveLength(0);
      expect(arityDiags(inBackend('balance url_param userid check_post 64'))).toHaveLength(0);
    });
  });

  describe('valid lines', () => {
    for (const [line, wrap] of [
      ['bind :80', inFrontend],
      ['bind *:443 ssl crt /etc/ssl/site.pem alpn h2,http/1.1', inFrontend],
      ['default_backend web', inFrontend],
      ['use_backend api if is_api', inFrontend],
      ['acl is_ssl ssl_fc', inFrontend],
      ['server web1 10.0.0.1:80', inBackend],
      ['server-template web 1-3 app.internal:80 check', inBackend],
      ['balance roundrobin', inBackend],
      ['mode http', inFrontend],
      ['log global', inFrontend],
      ['errorfile 503 /etc/haproxy/errors/503.http', inBackend],
    ] as const) {
      it(`accepts '${line}'`, () => {
        expect(arityDiags(wrap(line))).toHaveLength(0);
      });
    }

    it('ignores an inline comment', () => {
      expect(arityDiags(inFrontend('default_backend web # fallback pool'))).toHaveLength(0);
    });
  });

  describe('continuation lines', () => {
    it('counts arguments carried onto the next physical line', () => {
      expect(arityDiags('backend b\n    server web1 \\\n        10.0.0.1:80 check\n')).toHaveLength(0);
    });

    it('still reports a continued line that really is short', () => {
      expect(arityDiags('backend b\n    server \\\n        web1\n')).toHaveLength(1);
    });

    it('reports extra arguments spread across lines', () => {
      const range = arityDiags('frontend f\n    default_backend web \\\n        api\n')[0]?.range;
      expect(range?.start).toEqual({ line: 2, character: 8 });
    });
  });

  describe('environment substitution', () => {
    for (const [line, wrap] of [
      ['server web1 "${WEB1_ADDR}"', inBackend],
      ['server "${WEB1}"', inBackend],
      ['bind "${BIND_ADDR}"', inFrontend],
      ['default_backend ${BACKEND}', inFrontend],
      ['default_backend "${A}" "${B}"', inFrontend],
      ['server ${SERVER_LINE}', inBackend],
    ] as const) {
      it(`does not count words in '${line}'`, () => {
        expect(arityDiags(wrap(line))).toHaveLength(0);
      });
    }
  });

  describe('combined-name directives', () => {
    it('does not count the second word of the name as an argument', () => {
      expect(arityDiags('listen stats\n    stats uri\n')).toHaveLength(1);
      expect(arityDiags('listen stats\n    stats uri /stats\n')).toHaveLength(0);
    });

    it('names the combined directive in the message', () => {
      expect(arityDiags('listen stats\n    stats uri\n')[0]?.message).toContain("'stats uri' requires a URI prefix");
    });

    it('leaves unannotated combined names unchecked', () => {
      expect(arityDiags('backend b\n    option httpchk\n')).toHaveLength(0);
      expect(arityDiags('frontend f\n    tcp-request connection\n')).toHaveLength(0);
      expect(arityDiags('frontend f\n    option httplog\n')).toHaveLength(0);
    });
  });

  describe('scope', () => {
    it('skips special sections that reuse a name with a different shape', () => {
      // The local peer in a peers section may omit its address.
      expect(arityDiags('peers mypeers\n    server haproxy1\n')).toHaveLength(0);
    });

    it('leaves unannotated directives unchecked', () => {
      expect(arityDiags(inFrontend('http-request'))).toHaveLength(0);
      expect(arityDiags(inBackend('http-check'))).toHaveLength(0);
    });
  });

  describe('annotations', () => {
    it('name exactly minArgs required arguments wherever they are set', () => {
      for (const def of registry.getDirectives('3.2').values()) {
        if (def.minArgs === undefined) continue;
        expect({ name: def.name, count: def.requiredArgs?.length }).toEqual({ name: def.name, count: def.minArgs });
        if (def.maxArgs !== undefined) expect(def.maxArgs).toBeGreaterThanOrEqual(def.minArgs);
      }
    });
  });

  describe('known-good fixtures', () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures');
    const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.cfg') || f.endsWith('.conf'));

    for (const file of fixtures) {
      for (const version of registry.getKnownVersions()) {
        it(`adds no diagnostics to ${file} at ${version}`, () => {
          const text = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
          expect(arityDiags(text, version)).toEqual([]);
        });
      }
    }
  });
});
