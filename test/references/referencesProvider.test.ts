import { HaproxyParser } from '../../server/src/parser/parser';
import { ReferencesProvider } from '../../server/src/references/referencesProvider';

const parser = new HaproxyParser();
const provider = new ReferencesProvider();

const URI = 'test://refs';

function refs(text: string, line: number, character: number, includeDeclaration = true) {
  const doc = parser.parse(text, URI);
  return provider.provideReferences(doc, { line, character }, includeDeclaration);
}

/** The set of lines a reference result points at, for order-independent assertions. */
const linesOf = (locations: ReturnType<typeof refs>): number[] =>
  locations.map((l) => l.range.start.line).sort((a, b) => a - b);

describe('ReferencesProvider', () => {
  const config = [
    'frontend http',
    '    default_backend web',
    '    use_backend web if is_api',
    'backend web',
    '    server s1 10.0.0.1:80',
  ].join('\n');

  describe('backend names', () => {
    it('finds the declaration and every reference', () => {
      expect(linesOf(refs(config, 3, 9))).toEqual([1, 2, 3]);
    });

    it('omits the declaration when includeDeclaration is false', () => {
      expect(linesOf(refs(config, 3, 9, false))).toEqual([1, 2]);
    });

    it('returns the same set from a reference as from the declaration', () => {
      expect(linesOf(refs(config, 2, 17))).toEqual(linesOf(refs(config, 3, 9)));
    });

    it('reports the document uri on every location', () => {
      expect(refs(config, 3, 9).every((l) => l.uri === URI)).toBe(true);
    });

    it('points at the name, not the whole line', () => {
      const decl = refs(config, 3, 9).find((l) => l.range.start.line === 3);
      expect(decl?.range.start.character).toBe(8);
      expect(decl?.range.end.character).toBe(11);
    });
  });

  describe('precision', () => {
    it('does not match a name that contains the target as a substring', () => {
      const text = [
        'frontend http',
        '    use_backend web',
        '    use_backend web_static',
        'backend web',
        'backend web_static',
      ].join('\n');
      expect(linesOf(refs(text, 3, 9))).toEqual([1, 3]);
    });

    it('scopes ACL references to the owning section', () => {
      const text = [
        'frontend a',
        '    acl internal src 10.0.0.0/8',
        '    http-request deny if internal',
        'frontend b',
        '    acl internal src 192.168.0.0/16',
        '    http-request deny if internal',
      ].join('\n');
      expect(linesOf(refs(text, 1, 9))).toEqual([1, 2]);
    });

    it('finds a negated ACL reference', () => {
      const text = ['frontend http', '    acl is_api path_beg /api', '    http-request deny if !is_api'].join('\n');
      expect(linesOf(refs(text, 1, 9))).toEqual([1, 2]);
    });
  });

  describe('no resolvable symbol', () => {
    it('returns an empty array on a directive keyword', () => {
      expect(refs(config, 1, 6)).toEqual([]);
    });

    it('returns an empty array on an empty line', () => {
      expect(refs('frontend http\n\nbackend web', 1, 0)).toEqual([]);
    });

    it('returns an empty array for a backend that is only referenced, never defined', () => {
      // The reference itself still resolves, so the undefined target yields one location.
      const text = 'frontend http\n    use_backend ghost\n';
      expect(linesOf(refs(text, 1, 17))).toEqual([1]);
    });
  });
});
