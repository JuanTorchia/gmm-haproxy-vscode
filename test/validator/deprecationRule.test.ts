import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/** Diagnostics produced for a config, restricted to directive deprecation warnings. */
function deprecationDiags(text: string, version = '3.2'): Diagnostic[] {
  const doc = parser.parse(text, 'test://deprecation');
  const validator = new ValidationProvider(registry, version);
  return (validator.validate(doc) as Diagnostic[]).filter((d) => /^'[^']+' is deprecated since/.test(d.message));
}

const inHttpBackend = (line: string): string => `backend b\n    mode http\n    ${line}\n`;

describe('directive deprecation rule', () => {
  it('warns on a deprecated directive', () => {
    const diags = deprecationDiags(inHttpBackend('option httpclose'));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.severity).toBe(DiagnosticSeverity.Warning);
  });

  it('names the resolved directive and the version it was deprecated in', () => {
    const msg = deprecationDiags(inHttpBackend('option httpclose'))[0]?.message ?? '';
    expect(msg).toContain("'option httpclose'");
    expect(msg).toMatch(/deprecated since HAProxy \d+\.\d+/);
  });

  it('underlines the keyword', () => {
    const range = deprecationDiags(inHttpBackend('option httpclose'))[0]?.range;
    expect(range?.start.line).toBe(2);
    expect(range?.start.character).toBe(4);
    expect(range?.end.character).toBe(10);
  });

  it('stays silent on a current directive', () => {
    expect(deprecationDiags(inHttpBackend('option httplog'))).toHaveLength(0);
    expect(deprecationDiags(inHttpBackend('balance roundrobin'))).toHaveLength(0);
  });

  it('does not report deprecated actions — those belong to the action rule', () => {
    // The action warning uses the same wording but sits on the action, not the keyword.
    const onKeyword = deprecationDiags('frontend f\n    http-request set-mark 0x1\n').filter(
      (d) => d.range.start.character === 4
    );
    expect(onKeyword).toHaveLength(0);
  });
});
