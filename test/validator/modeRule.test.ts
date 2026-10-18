import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

/** Diagnostics produced for a config, restricted to mode conflicts. */
function modeDiags(text: string): Diagnostic[] {
  const doc = parser.parse(text, 'test://mode');
  const validator = new ValidationProvider(registry, '3.2');
  return (validator.validate(doc) as Diagnostic[]).filter((d) => / requires (HTTP|TCP) mode /.test(d.message));
}

describe('mode conflict rule', () => {
  it('rejects an HTTP-only directive in a TCP section', () => {
    const diags = modeDiags('frontend f\n    mode tcp\n    http-request set-header X-Test v\n');
    expect(diags).toHaveLength(1);
    expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
    expect(diags[0]?.message).toBe("'http-request' requires HTTP mode but this section is in TCP mode.");
  });

  it('rejects a TCP-only directive in an HTTP section', () => {
    const diags = modeDiags('backend b\n    mode http\n    persist rdp-cookie\n');
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toBe("'persist rdp-cookie' requires TCP mode but this section is in HTTP mode.");
  });

  it('inherits the mode from defaults', () => {
    expect(modeDiags('defaults\n    mode tcp\nfrontend f\n    http-request deny\n')).toHaveLength(1);
  });

  it('accepts a directive matching the section mode', () => {
    expect(modeDiags('frontend f\n    mode http\n    http-request deny\n')).toHaveLength(0);
    expect(modeDiags('backend b\n    mode tcp\n    persist rdp-cookie\n')).toHaveLength(0);
  });

  it('stays silent when the mode is unknown', () => {
    expect(modeDiags('frontend f\n    http-request deny\n')).toHaveLength(0);
    expect(modeDiags('backend b\n    persist rdp-cookie\n')).toHaveLength(0);
  });

  it('underlines the keyword', () => {
    const range = modeDiags('frontend f\n    mode tcp\n    http-request deny\n')[0]?.range;
    expect(range?.start.line).toBe(2);
    expect(range?.start.character).toBe(4);
    expect(range?.end.character).toBe(16);
  });
});
