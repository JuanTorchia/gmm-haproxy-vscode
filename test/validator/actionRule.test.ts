import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/** Diagnostics produced for a config, restricted to action sub-keyword findings. */
function actionDiags(text: string, version = '3.2'): Diagnostic[] {
  const doc = parser.parse(text, 'test://action');
  const validator = new ValidationProvider(registry, version);
  return (validator.validate(doc) as Diagnostic[]).filter(
    (d) =>
      / action '/.test(d.message) ||
      d.message.includes('is not a valid action for') ||
      /^'[^']+' is deprecated since/.test(d.message)
  );
}

const inFrontend = (line: string): string => `frontend f\n    ${line}\n`;
const inBackend = (line: string): string => `backend b\n    ${line}\n`;

describe('action sub-keyword rule', () => {
  describe('unknown actions', () => {
    it('rejects an unknown http-request action', () => {
      const diags = actionDiags(inFrontend('http-request unknown-action'));
      expect(diags).toHaveLength(1);
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diags[0]?.message).toBe("Unknown http-request action 'unknown-action'.");
    });

    it('rejects an unknown tcp-request connection action, reading the second argument', () => {
      const diags = actionDiags(inFrontend('tcp-request connection not-an-action'));
      expect(diags).toHaveLength(1);
      expect(diags[0]?.message).toBe("Unknown tcp-request connection action 'not-an-action'.");
    });

    it('underlines the action, not the keyword', () => {
      // `    http-request bogus` — the action starts at column 17
      const range = actionDiags(inFrontend('http-request bogus'))[0]?.range;
      expect(range?.start.character).toBe(17);
      expect(range?.end.character).toBe(22);
    });
  });

  describe('misplaced actions', () => {
    it('rejects an HTTP action under tcp-request connection', () => {
      const diags = actionDiags(inFrontend('tcp-request connection set-header X-Test v'));
      expect(diags).toHaveLength(1);
      expect(diags[0]?.message).toBe("'set-header' is not a valid action for 'tcp-request connection'.");
    });
  });

  describe('valid actions', () => {
    for (const line of [
      'http-request deny',
      'http-request set-header X-Test v',
      'http-request set-var(txn.x) str(a)',
      'tcp-request connection accept',
      'tcp-request content set-var(txn.x) int(1)',
    ]) {
      it(`accepts ${line}`, () => {
        expect(actionDiags(inFrontend(line))).toHaveLength(0);
      });
    }

    it('accepts http-after-response set-header', () => {
      expect(actionDiags(inBackend('http-after-response set-header X-Test v'))).toHaveLength(0);
    });

    it('ignores directives that carry no action', () => {
      expect(actionDiags(inFrontend('tcp-request inspect-delay 5s'))).toHaveLength(0);
    });

    it('ignores a rule directive with no action at all', () => {
      expect(actionDiags(inFrontend('http-request'))).toHaveLength(0);
    });
  });

  describe('deprecated actions', () => {
    it('warns from the version the action was deprecated in', () => {
      const diags = actionDiags(inFrontend('http-request set-mark 0x1'), '2.6');
      expect(diags).toHaveLength(1);
      expect(diags[0]?.severity).toBe(DiagnosticSeverity.Warning);
      expect(diags[0]?.message).toBe("'set-mark' is deprecated since HAProxy 2.6.");
    });

    it('stays silent before that version', () => {
      expect(actionDiags(inFrontend('http-request set-mark 0x1'), '2.4')).toHaveLength(0);
    });
  });
});
