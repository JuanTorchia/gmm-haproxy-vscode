import { HaproxyParser } from '../../server/src/parser/parser';
import { DefinitionProvider } from '../../server/src/definition/definitionProvider';

const parser = new HaproxyParser();
const provider = new DefinitionProvider();

function getDefinition(text: string, line: number, character: number) {
  const doc = parser.parse(text, 'test://def');
  return provider.provideDefinition(doc, { line, character });
}

describe('DefinitionProvider', () => {
  describe('use_backend resolution', () => {
    const text = [
      'frontend http',
      '    use_backend web',
      'backend web',
      '    balance roundrobin',
    ].join('\n');

    it('returns location of target backend header', () => {
      // Cursor on "web" in use_backend web (line 1, char 17 — inside "web")
      const loc = getDefinition(text, 1, 17);
      expect(loc).not.toBeNull();
      expect(loc!.uri).toBe('test://def');
      expect(loc!.range.start.line).toBe(2); // "backend web" is on line 2
    });

    it('returns null when cursor is on the keyword itself', () => {
      // Cursor on "use_backend" keyword (line 1, char 5)
      const loc = getDefinition(text, 1, 5);
      expect(loc).toBeNull();
    });
  });

  describe('default_backend resolution', () => {
    const text = [
      'frontend http',
      '    default_backend fallback',
      'backend fallback',
      '    balance roundrobin',
    ].join('\n');

    it('resolves default_backend to target', () => {
      const loc = getDefinition(text, 1, 22);
      expect(loc).not.toBeNull();
      expect(loc!.range.start.line).toBe(2);
    });
  });

  describe('listen section as target', () => {
    const text = [
      'frontend http',
      '    use_backend stats-listener',
      'listen stats-listener',
      '    bind *:8404',
    ].join('\n');

    it('resolves use_backend to a listen section', () => {
      const loc = getDefinition(text, 1, 20);
      expect(loc).not.toBeNull();
      expect(loc!.range.start.line).toBe(2);
    });
  });

  describe('undefined backend', () => {
    it('returns null when target backend does not exist', () => {
      const text = 'frontend http\n    use_backend ghost\n';
      const loc = getDefinition(text, 1, 18);
      expect(loc).toBeNull();
    });
  });

  describe('dynamic backend selection', () => {
    it('returns null for % expressions', () => {
      const text = 'frontend http\n    use_backend %[req.cook(SERVERID)]\n';
      const loc = getDefinition(text, 1, 20);
      expect(loc).toBeNull();
    });
  });

  describe('case-insensitive matching', () => {
    const text = [
      'frontend http',
      '    use_backend Web',
      'backend web',
      '    balance roundrobin',
    ].join('\n');

    it('matches backend name case-insensitively', () => {
      const loc = getDefinition(text, 1, 18);
      expect(loc).not.toBeNull();
      expect(loc!.range.start.line).toBe(2);
    });
  });

  describe('empty document', () => {
    it('returns null on empty document', () => {
      expect(getDefinition('', 0, 0)).toBeNull();
    });
  });

  describe('no backend reference at position', () => {
    it('returns null on a non-reference directive', () => {
      const text = 'backend web\n    balance roundrobin\n';
      expect(getDefinition(text, 1, 8)).toBeNull();
    });
  });
});
