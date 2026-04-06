import { HaproxyParser } from '../../server/src/parser/parser';
import { SymbolsProvider } from '../../server/src/symbols/symbolsProvider';
import { SymbolKind } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const provider = new SymbolsProvider();

function getSymbols(text: string) {
  const doc = parser.parse(text, 'test://symbols');
  return provider.provideSymbols(doc);
}

describe('SymbolsProvider', () => {
  describe('empty document', () => {
    it('returns empty array for empty input', () => {
      expect(getSymbols('')).toHaveLength(0);
    });
  });

  describe('symbol names', () => {
    it('labels a named section with "type name"', () => {
      const syms = getSymbols('frontend http-in\n    bind *:80\n');
      expect(syms[0]?.name).toBe('frontend http-in');
    });

    it('labels an unnamed section with just the type', () => {
      const syms = getSymbols('global\n    daemon\n');
      expect(syms[0]?.name).toBe('global');
    });

    it('labels defaults section without name', () => {
      const syms = getSymbols('defaults\n    mode http\n');
      expect(syms[0]?.name).toBe('defaults');
    });
  });

  describe('symbol kinds', () => {
    it('global → Namespace', () => {
      expect(getSymbols('global\n    daemon\n')[0]?.kind).toBe(SymbolKind.Namespace);
    });

    it('defaults → Module', () => {
      expect(getSymbols('defaults\n    mode http\n')[0]?.kind).toBe(SymbolKind.Module);
    });

    it('frontend → Interface', () => {
      expect(getSymbols('frontend http\n    bind *:80\n')[0]?.kind).toBe(SymbolKind.Interface);
    });

    it('backend → Class', () => {
      expect(getSymbols('backend web\n    balance roundrobin\n')[0]?.kind).toBe(SymbolKind.Class);
    });

    it('listen → Function', () => {
      expect(getSymbols('listen stats\n    bind *:8404\n')[0]?.kind).toBe(SymbolKind.Function);
    });

    it('userlist → Object', () => {
      expect(getSymbols('userlist admins\n    user alice password hash\n')[0]?.kind).toBe(SymbolKind.Object);
    });

    it('peers → Module', () => {
      expect(getSymbols('peers cluster\n    peer n1 10.0.0.1:1024\n')[0]?.kind).toBe(SymbolKind.Module);
    });

    it('resolvers → Module', () => {
      expect(getSymbols('resolvers dns\n    nameserver ns1 8.8.8.8:53\n')[0]?.kind).toBe(SymbolKind.Module);
    });

    it('cache → Module', () => {
      expect(getSymbols('cache webcache\n    total-max-size 64\n')[0]?.kind).toBe(SymbolKind.Module);
    });
  });

  describe('multiple sections', () => {
    it('returns one symbol per section', () => {
      const text = [
        'global',
        '    daemon',
        '',
        'defaults',
        '    mode http',
        '',
        'frontend http',
        '    bind *:80',
        '',
        'backend web',
        '    balance roundrobin',
      ].join('\n');
      const syms = getSymbols(text);
      expect(syms).toHaveLength(4);
      expect(syms.map((s) => s.name)).toEqual(['global', 'defaults', 'frontend http', 'backend web']);
    });
  });

  describe('selection range', () => {
    it('selectionRange starts on the header line', () => {
      const syms = getSymbols('backend web\n    balance roundrobin\n');
      expect(syms[0]?.selectionRange.start.line).toBe(0);
    });
  });

  describe('full range', () => {
    it('first section range ends before the next section starts', () => {
      const text = 'frontend http\n    bind *:80\n\nbackend web\n    balance roundrobin\n';
      const syms = getSymbols(text);
      expect(syms).toHaveLength(2);
      // First section must end before line 3 (where backend starts)
      expect(syms[0]!.range.end.line).toBeLessThan(syms[1]!.range.start.line);
    });

    it('last section range ends at its last directive', () => {
      const text = 'backend web\n    balance roundrobin\n';
      const syms = getSymbols(text);
      // Should end on line 1 (the directive line)
      expect(syms[0]!.range.end.line).toBe(1);
    });
  });

  describe('child symbols', () => {
    it('bind directives appear as Event children', () => {
      const syms = getSymbols('frontend http\n    bind *:80\n    bind *:443 ssl crt /etc/ssl/h.pem\n');
      const children = syms[0]?.children ?? [];
      expect(children.filter((c) => c.kind === SymbolKind.Event)).toHaveLength(2);
      expect(children[0]?.name).toBe('bind *:80');
    });

    it('server directives appear as Field children', () => {
      const syms = getSymbols('backend web\n    server s1 10.0.0.1:80 check\n    server s2 10.0.0.2:80\n');
      const children = syms[0]?.children ?? [];
      expect(children.filter((c) => c.kind === SymbolKind.Field)).toHaveLength(2);
      expect(children[0]?.name).toBe('server s1');
      expect(children[0]?.detail).toBe('10.0.0.1:80');
    });

    it('acl directives appear as Constant children', () => {
      const syms = getSymbols('frontend http\n    acl is_api path_beg /api\n    bind *:80\n');
      const children = syms[0]?.children ?? [];
      const aclChildren = children.filter((c) => c.kind === SymbolKind.Constant);
      expect(aclChildren).toHaveLength(1);
      expect(aclChildren[0]?.name).toBe('acl is_api');
    });

    it('non-structural directives do not appear as children', () => {
      const syms = getSymbols('backend web\n    balance roundrobin\n    option httpchk GET /health\n');
      const children = syms[0]?.children ?? [];
      expect(children).toHaveLength(0);
    });

    it('section with no directives has empty children', () => {
      const syms = getSymbols('backend web\n');
      expect(syms[0]?.children).toHaveLength(0);
    });
  });
});
