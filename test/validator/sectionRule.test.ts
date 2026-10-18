import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/** Diagnostics produced for a config, restricted to wrong-section errors. */
function sectionDiags(text: string): Diagnostic[] {
  const doc = parser.parse(text, 'test://section');
  const validator = new ValidationProvider(registry, '3.2');
  return (validator.validate(doc) as Diagnostic[]).filter((d) => d.message.includes('section. Valid sections:'));
}

describe('wrong-section rule', () => {
  it('rejects use_backend in a backend', () => {
    const diags = sectionDiags('backend web\n    use_backend other\n');
    expect(diags).toHaveLength(1);
    expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
  });

  it('rejects balance in a frontend', () => {
    expect(sectionDiags('frontend f\n    balance roundrobin\n')).toHaveLength(1);
  });

  it('names the section and lists where the directive is valid', () => {
    const msg = sectionDiags('backend web\n    use_backend other\n')[0]?.message ?? '';
    expect(msg).toContain("'use_backend' is not valid in a 'backend' section");
    expect(msg).toContain('frontend');
    expect(msg).toContain('listen');
  });

  it('underlines the keyword', () => {
    const range = sectionDiags('backend web\n    use_backend other\n')[0]?.range;
    expect(range?.start.line).toBe(1);
    expect(range?.start.character).toBe(4);
    expect(range?.end.character).toBe(15);
  });

  for (const section of ['defaults', 'backend web', 'listen stats']) {
    it(`accepts balance in ${section}`, () => {
      expect(sectionDiags(`${section}\n    balance roundrobin\n`)).toHaveLength(0);
    });
  }

  it('accepts a global-only directive in global', () => {
    expect(sectionDiags('global\n    maxconn 1000\n')).toHaveLength(0);
  });
});
