import { HaproxyParser } from '../../server/src/parser/parser';
import { CodeActionsProvider, SAFE_REPLACEMENTS } from '../../server/src/codeactions/codeActionsProvider';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const provider = new CodeActionsProvider();

function makeDeprecatedDiag(line: number, message: string): Diagnostic {
  return {
    severity: DiagnosticSeverity.Warning,
    range: { start: { line, character: 4 }, end: { line, character: 20 } },
    message,
    source: 'haproxy',
  };
}

function getActions(text: string, diagnostics: Diagnostic[]) {
  const doc = parser.parse(text, 'test://actions');
  return provider.provideCodeActions(
    doc,
    { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
    diagnostics
  );
}

describe('CodeActionsProvider', () => {
  describe('option httpclose replacement', () => {
    const text = 'backend web\n    option httpclose\n';

    it('offers quick fix for deprecated option httpclose', () => {
      const diag = makeDeprecatedDiag(1, "'option httpclose' is deprecated since HAProxy 1.5. Use 'option http-server-close' instead.");
      const actions = getActions(text, [diag]);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.title).toContain('http-server-close');
    });

    it('action is marked as QuickFix kind', () => {
      const diag = makeDeprecatedDiag(1, "'option httpclose' is deprecated since HAProxy 1.5.");
      const actions = getActions(text, [diag]);
      expect(actions[0]?.kind).toBe('quickfix');
    });

    it('action is marked as preferred', () => {
      const diag = makeDeprecatedDiag(1, "'option httpclose' is deprecated since HAProxy 1.5.");
      const actions = getActions(text, [diag]);
      expect(actions[0]?.isPreferred).toBe(true);
    });

    it('edit replaces the directive text', () => {
      const diag = makeDeprecatedDiag(1, "'option httpclose' is deprecated since HAProxy 1.5.");
      const actions = getActions(text, [diag]);
      const changes = actions[0]?.edit?.changes?.['test://actions'];
      expect(changes).toBeDefined();
      expect(changes![0]?.newText).toBe('option http-server-close');
    });
  });

  describe('option forceclose replacement', () => {
    it('offers quick fix for deprecated option forceclose', () => {
      const text = 'backend web\n    option forceclose\n';
      const diag = makeDeprecatedDiag(1, "'option forceclose' is deprecated since HAProxy 2.0.");
      const actions = getActions(text, [diag]);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.title).toContain('http-server-close');
    });
  });

  describe('no fix for complex migrations', () => {
    it('does not offer quick fix for reqrep (syntax too different)', () => {
      const text = 'frontend http\n    reqrep ^Host:\\ (.*) Host:\\ \\1\n';
      const diag = makeDeprecatedDiag(1, "'reqrep' is deprecated since HAProxy 1.9. Use 'http-request replace-value' instead.");
      const actions = getActions(text, [diag]);
      expect(actions).toHaveLength(0);
    });
  });

  describe('no diagnostics', () => {
    it('returns empty array when no diagnostics are provided', () => {
      const text = 'backend web\n    balance roundrobin\n';
      expect(getActions(text, [])).toHaveLength(0);
    });
  });

  describe('non-deprecation diagnostics', () => {
    it('ignores error diagnostics', () => {
      const text = 'backend web\n    unknowndirective\n';
      const diag: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: { start: { line: 1, character: 4 }, end: { line: 1, character: 20 } },
        message: "Unknown directive 'unknowndirective'.",
        source: 'haproxy',
      };
      expect(getActions(text, [diag])).toHaveLength(0);
    });
  });

  /**
   * Smoke test: every entry in SAFE_REPLACEMENTS must have a matching directive
   * in the data that actually generates a deprecation warning. This test catches
   * the class of bug where a quick-fix key has no data backing it (silent no-op).
   */
  describe('SAFE_REPLACEMENTS smoke test — every key generates a real deprecation warning', () => {
    const registry = new VersionRegistry();
    const validator = new ValidationProvider(registry, '3.1');

    for (const directiveName of Object.keys(SAFE_REPLACEMENTS)) {
      it(`'${directiveName}' triggers a deprecation warning on version 3.1`, () => {
        const [kw, ...args] = directiveName.split(' ');
        const indent = '    ';
        const line = args.length > 0
          ? `${indent}${kw} ${args.join(' ')}`
          : `${indent}${kw}`;
        const text = `backend web\n${line}\n`;
        const doc = parser.parse(text, 'test://smoke');
        const diags = validator.validate(doc) as Diagnostic[];
        const deprecationWarning = diags.find(
          (d) => d.message.includes('is deprecated since HAProxy')
                 && d.message.toLowerCase().includes(directiveName.toLowerCase())
        );
        expect(deprecationWarning).toBeDefined();
      });
    }
  });
});
