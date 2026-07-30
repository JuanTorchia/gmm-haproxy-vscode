import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/** Diagnostics produced for a config, restricted to those about port ranges. */
function portDiags(text: string): Diagnostic[] {
  const doc = parser.parse(text, 'test://port');
  const validator = new ValidationProvider(registry, '3.2');
  return (validator.validate(doc) as Diagnostic[]).filter((d) => d.message.includes('out of range'));
}

const inFrontend = (line: string): string => `frontend f\n    ${line}\n`;
const inBackend = (line: string): string => `backend b\n    ${line}\n`;

describe('port range validation', () => {
  describe('bind', () => {
    for (const addr of [':80', '*:443', '0.0.0.0:8080', '127.0.0.1:8404', ':::443', '[::1]:80', ':1', ':65535']) {
      it(`accepts ${addr}`, () => {
        expect(portDiags(inFrontend(`bind ${addr}`))).toHaveLength(0);
      });
    }

    for (const addr of [':0', ':65536', ':99999', '*:70000', '10.0.0.1:123456']) {
      it(`rejects ${addr}`, () => {
        const diags = portDiags(inFrontend(`bind ${addr}`));
        expect(diags).toHaveLength(1);
        expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
      });
    }

    it('names the offending port and the valid range', () => {
      const msg = portDiags(inFrontend('bind :70000'))[0]?.message ?? '';
      expect(msg).toContain('70000');
      expect(msg).toContain('1-65535');
    });

    it('underlines the port, not the whole address', () => {
      // `    bind :70000` — the address starts at column 9, the port at 10
      const range = portDiags(inFrontend('bind :70000'))[0]?.range;
      expect(range?.start.character).toBe(10);
      expect(range?.end.character).toBe(15);
    });

    it('keeps trailing bind options out of it', () => {
      expect(portDiags(inFrontend('bind *:443 ssl crt /etc/ssl/haproxy.pem alpn h2,http/1.1'))).toHaveLength(0);
    });
  });

  describe('server', () => {
    it('accepts a valid port', () => {
      expect(portDiags(inBackend('server web1 10.0.0.1:8080 check'))).toHaveLength(0);
    });

    it('rejects an out-of-range port', () => {
      expect(portDiags(inBackend('server web1 10.0.0.1:70000 check'))).toHaveLength(1);
    });

    it('accepts port 0, which inherits the incoming port', () => {
      // This is the trap: 0 is out of range for bind but meaningful on a server line.
      expect(portDiags(inBackend('server web1 10.0.0.1:0 check'))).toHaveLength(0);
    });

    it('mentions the 0 exception in the server message', () => {
      const msg = portDiags(inBackend('server web1 10.0.0.1:70000'))[0]?.message ?? '';
      expect(msg).toContain('inherit the incoming port');
    });

    it('accepts an address with no port at all', () => {
      expect(portDiags(inBackend('server web1 10.0.0.1 check'))).toHaveLength(0);
    });

    it('does not treat the server name as an address', () => {
      expect(portDiags(inBackend('server web1 10.0.0.1:8080'))).toHaveLength(0);
    });
  });

  describe('port ranges', () => {
    it('accepts a valid range', () => {
      expect(portDiags(inFrontend('bind :8080-8090'))).toHaveLength(0);
    });

    it('rejects a range whose upper bound is out of range', () => {
      expect(portDiags(inFrontend('bind :8080-70000'))).toHaveLength(1);
    });

    it('reports both bounds when both are invalid', () => {
      expect(portDiags(inFrontend('bind :0-70000'))).toHaveLength(2);
    });
  });

  describe('comma-separated addresses', () => {
    it('accepts several valid addresses', () => {
      expect(portDiags(inFrontend('bind :80,:443'))).toHaveLength(0);
    });

    it('reports only the invalid one', () => {
      const diags = portDiags(inFrontend('bind :80,:70000'));
      expect(diags).toHaveLength(1);
      expect(diags[0]?.message).toContain('70000');
    });
  });

  describe('addresses with no determinable port', () => {
    for (const addr of [
      '/var/run/haproxy.sock',
      'unix@/var/run/haproxy.sock',
      'abns@haproxy',
      'fd@3',
      'sockpair@4',
    ]) {
      it(`skips ${addr}`, () => {
        expect(portDiags(inFrontend(`bind ${addr}`))).toHaveLength(0);
      });
    }

    it('skips environment substitution', () => {
      expect(portDiags(inFrontend('bind :"${PORT}"'))).toHaveLength(0);
    });

    it('skips a bracket-less IPv6 literal rather than guessing its last group is a port', () => {
      expect(portDiags(inBackend('server web1 2001:db8::1'))).toHaveLength(0);
    });

    it('still checks a bracketed IPv6 address, where the port is unambiguous', () => {
      expect(portDiags(inFrontend('bind [2001:db8::1]:70000'))).toHaveLength(1);
    });

    it('skips a bracketed address with no port', () => {
      expect(portDiags(inBackend('server web1 [2001:db8::1]'))).toHaveLength(0);
    });

    it('skips an unterminated bracket rather than mis-parsing it', () => {
      expect(portDiags(inFrontend('bind [2001:db8::1:80'))).toHaveLength(0);
    });

    it('skips an absurdly long address without parsing it', () => {
      expect(portDiags(inFrontend(`bind :${'9'.repeat(300)}`))).toHaveLength(0);
    });

    it('skips a non-numeric port rather than guessing', () => {
      expect(portDiags(inBackend('server web1 example.com:http'))).toHaveLength(0);
    });

    it('skips an empty port field', () => {
      expect(portDiags(inBackend('server web1 10.0.0.1:'))).toHaveLength(0);
    });

    it('skips a port with more digits than any port could have', () => {
      expect(portDiags(inFrontend('bind :12345678901'))).toHaveLength(0);
    });
  });

  describe('directives that are not addresses', () => {
    it('ignores balance', () => {
      expect(portDiags(inBackend('balance roundrobin'))).toHaveLength(0);
    });

    it('ignores default-server, which carries no address', () => {
      expect(portDiags(inBackend('default-server check inter 5s'))).toHaveLength(0);
    });
  });
});
