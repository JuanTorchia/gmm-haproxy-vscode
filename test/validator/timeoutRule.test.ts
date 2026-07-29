import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { takesTimeValue } from '../../server/src/validation/rules/timeoutRule';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/** Diagnostics produced for a config, restricted to those about time values. */
function timeDiags(text: string, version = '3.2'): Diagnostic[] {
  const doc = parser.parse(text, 'test://timeout');
  const validator = new ValidationProvider(registry, version);
  return (validator.validate(doc) as Diagnostic[]).filter(
    (d) =>
      d.message.includes('milliseconds') ||
      d.message.includes('not a valid time value') ||
      d.message.includes('space between the value')
  );
}

const inDefaults = (line: string): string => `defaults\n    ${line}\n`;

describe('timeout value validation', () => {
  describe('unit-less values', () => {
    it('warns that a bare number is milliseconds', () => {
      const diags = timeDiags(inDefaults('timeout connect 5'));
      expect(diags).toHaveLength(1);
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Warning);
    });

    it('is a Warning, not an Error — the config still loads', () => {
      // `timeout connect 5` is legal HAProxy config; it just means 5ms.
      expect(timeDiags(inDefaults('timeout connect 5'))[0]?.severity).toBe(
        DiagnosticSeverity.Warning
      );
    });

    it('states the actual meaning and the fix', () => {
      const msg = timeDiags(inDefaults('timeout connect 5'))[0]?.message ?? '';
      expect(msg).toContain('5 milliseconds');
      expect(msg).toContain("'5s'");
    });

    it('points at the value, not the whole line', () => {
      const diags = timeDiags(inDefaults('timeout connect 5'));
      const range = diags[0]?.range;
      // `    timeout connect 5` — the value starts at column 20
      expect(range?.start.character).toBe(20);
      expect(range?.end.character).toBe(21);
    });

    it('flags each unit-less timeout in a realistic defaults block', () => {
      const config = 'defaults\n    timeout connect 5\n    timeout client 30\n    timeout server 30\n';
      expect(timeDiags(config)).toHaveLength(3);
    });

    it('does not warn on 0, which deliberately disables the timeout', () => {
      expect(timeDiags(inDefaults('timeout connect 0'))).toHaveLength(0);
    });
  });

  describe('valid values', () => {
    for (const value of ['5us', '5ms', '5s', '5m', '5h', '5d']) {
      it(`accepts ${value}`, () => {
        expect(timeDiags(inDefaults(`timeout connect ${value}`))).toHaveLength(0);
      });
    }

    it('accepts multi-digit values', () => {
      expect(timeDiags(inDefaults('timeout client 30000ms'))).toHaveLength(0);
    });

    it('accepts 0 with an explicit unit', () => {
      expect(timeDiags(inDefaults('timeout tunnel 0s'))).toHaveLength(0);
    });
  });

  describe('malformed values', () => {
    for (const value of ['5x', 'abc', '5sec', '5.5s', '-5s']) {
      it(`reports an error for '${value}'`, () => {
        const diags = timeDiags(inDefaults(`timeout connect ${value}`));
        expect(diags.length).toBeGreaterThan(0);
        expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
      });
    }

    it('is an Error, not a Warning — HAProxy will not load it', () => {
      expect(timeDiags(inDefaults('timeout connect 5x'))[0]?.severity).toBe(
        DiagnosticSeverity.Error
      );
    });

    it('lists the valid units in the message', () => {
      const msg = timeDiags(inDefaults('timeout connect 5x'))[0]?.message ?? '';
      expect(msg).toContain('us, ms, s, m, h, d');
    });

    it('rejects an absurdly long value without attempting to parse it', () => {
      const diags = timeDiags(inDefaults(`timeout connect ${'9'.repeat(500)}`));
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    it('catches a space between the value and its unit', () => {
      // Parses as two arguments, so it would otherwise read as a bare `5`.
      const diags = timeDiags(inDefaults('timeout connect 5 s'));
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diags[0]?.message).toContain("'5s'");
    });

    it('does not mistake a following directive argument for a stray unit', () => {
      // `m` here is a value of a different directive, not a detached unit.
      expect(timeDiags(inDefaults('timeout connect 5s'))).toHaveLength(0);
    });
  });

  describe('values the rule cannot check', () => {
    it('ignores environment variable substitution', () => {
      expect(timeDiags(inDefaults('timeout connect "${CONNECT_TIMEOUT}"'))).toHaveLength(0);
    });

    it('ignores a missing value — other rules cover incomplete lines', () => {
      expect(timeDiags(inDefaults('timeout connect'))).toHaveLength(0);
    });
  });

  describe('directive coverage', () => {
    it('covers the whole timeout family, not just the defaults three', () => {
      const config =
        'backend web\n' +
        '    timeout check 5\n' +
        '    timeout queue 5\n' +
        '    timeout tunnel 5\n' +
        '    timeout server-fin 5\n';
      expect(timeDiags(config)).toHaveLength(4);
    });

    it('covers single-word global timeouts, where the value is the first argument', () => {
      expect(timeDiags('global\n    tune.lua.task-timeout 4\n')).toHaveLength(1);
    });

    it('covers `stats timeout`', () => {
      expect(timeDiags('global\n    stats timeout 30\n')).toHaveLength(1);
    });

    it('covers `tcp-request inspect-delay`', () => {
      expect(timeDiags('frontend f\n    mode tcp\n    tcp-request inspect-delay 5\n')).toHaveLength(1);
    });

    it('does not flag directives that merely contain the word timeout', () => {
      // `http-request set-timeout <name> <value>` has its own shape.
      expect(timeDiags('frontend f\n    http-request set-timeout server 5s\n')).toHaveLength(0);
    });
  });

  describe('takesTimeValue', () => {
    for (const name of [
      'timeout connect',
      'timeout http-keep-alive',
      'stats timeout',
      'tune.lua.session-timeout',
      'tcp-request inspect-delay',
    ]) {
      it(`recognises '${name}'`, () => {
        expect(takesTimeValue(name)).toBe(true);
      });
    }

    for (const name of ['set-timeout', 'balance', 'server', 'mode', 'option httplog']) {
      it(`does not recognise '${name}'`, () => {
        expect(takesTimeValue(name)).toBe(false);
      });
    }
  });
});
