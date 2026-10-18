import { HaproxyParser } from '../../server/src/parser/parser';
import { ValidationProvider } from '../../server/src/validation/validator';
import { VersionRegistry } from '../../server/src/registry/versionRegistry';
import { Diagnostic, DiagnosticSeverity } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const registry = new VersionRegistry();

function errors(text: string, version = '3.2'): Diagnostic[] {
  const doc = parser.parse(text, 'test://unresolved');
  return (new ValidationProvider(registry, version).validate(doc) as Diagnostic[]).filter(
    (d) => d.severity === DiagnosticSeverity.Error
  );
}

describe('unresolved directive messages', () => {
  it('reports a removed directive as removed, with its migration path', () => {
    const [diag] = errors('backend web\n    mode http\n    reqrep ^Host:\\ www\\.example\\.com Host:\\ example.com\n');
    expect(diag?.message).toBe(
      "'reqrep' was removed in HAProxy 2.1 and is not accepted by HAProxy 3.2. " +
        "Use 'http-request replace-header', 'replace-path' or 'replace-uri' instead."
    );
  });

  const hints: ReadonlyArray<[string, string]> = [
    ['rsprep ^Server:\\ .* Server:\\ x', "Use 'http-response replace-header' or 'replace-value' instead."],
    ['reqdel ^X-Forwarded-For:.*', "Use 'http-request del-header' instead."],
    ['rspdel ^Server:.*', "Use 'http-response del-header' instead."],
    ['reqadd X-Proto:\\ https', "Use 'http-request add-header' instead."],
    ['rspadd X-Frame-Options:\\ DENY', "Use 'http-response add-header' instead."],
  ];
  for (const [line, hint] of hints) {
    it(`gives a migration hint for ${line.split(' ')[0] ?? line}`, () => {
      const [diag] = errors(`backend web\n    mode http\n    ${line}\n`, '2.4');
      expect(diag?.message).toContain('was removed in HAProxy 2.1');
      expect(diag?.message).toContain(hint);
    });
  }

  it('reports a program-section directive removed in 3.3 without a hint', () => {
    const [diag] = errors('program api\n    command /usr/bin/api\n', '3.3');
    expect(diag?.message).toBe("'command' was removed in HAProxy 3.3 and is not accepted by HAProxy 3.3.");
  });

  it('names only the keyword when the second word is an argument', () => {
    const [diag] = errors('backend web\n    notadirective foo\n');
    expect(diag?.message).toBe("Unknown directive 'notadirective'.");
  });

  it('keeps the two-word name for a combined-name family such as option', () => {
    const [diag] = errors('backend web\n    option notanoption\n');
    expect(diag?.message).toBe("Unknown directive 'option notanoption'.");
  });
});
