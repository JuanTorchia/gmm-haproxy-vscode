import { HaproxyParser } from '../../server/src/parser/parser';
import { DocumentHighlightProvider } from '../../server/src/highlights/documentHighlightProvider';
import { DocumentHighlightKind } from '../__mocks__/vscode-languageserver';

const parser = new HaproxyParser();
const provider = new DocumentHighlightProvider();

function highlights(text: string, line: number, character: number) {
  const doc = parser.parse(text, 'test://highlight');
  return provider.provideHighlights(doc, { line, character });
}

describe('DocumentHighlightProvider', () => {
  const config = [
    'frontend http',
    '    default_backend web',
    '    use_backend web if is_api',
    'backend web',
    '    server s1 10.0.0.1:80',
  ].join('\n');

  it('highlights every occurrence of the symbol', () => {
    expect(highlights(config, 3, 9)).toHaveLength(3);
  });

  it('marks the definition as Write and references as Read', () => {
    const result = highlights(config, 3, 9);
    const definition = result.find((h) => h.range.start.line === 3);
    const references = result.filter((h) => h.range.start.line !== 3);

    expect(definition?.kind).toBe(DocumentHighlightKind.Write);
    expect(references).toHaveLength(2);
    expect(references.every((h) => h.kind === DocumentHighlightKind.Read)).toBe(true);
  });

  it('produces exactly one Write highlight', () => {
    const writes = highlights(config, 3, 9).filter((h) => h.kind === DocumentHighlightKind.Write);
    expect(writes).toHaveLength(1);
  });

  it('gives the same set whether triggered from the definition or a reference', () => {
    const fromDefinition = highlights(config, 3, 9).map((h) => h.range.start.line).sort();
    const fromReference = highlights(config, 2, 17).map((h) => h.range.start.line).sort();
    expect(fromReference).toEqual(fromDefinition);
  });

  it('highlights the name only, not the whole line', () => {
    const h = highlights(config, 3, 9).find((x) => x.range.start.line === 3);
    expect(h?.range.start.character).toBe(8);
    expect(h?.range.end.character).toBe(11);
  });

  it('does not highlight a name containing the target as a substring', () => {
    const text = [
      'frontend http',
      '    use_backend web',
      '    use_backend web_static',
      'backend web',
      'backend web_static',
    ].join('\n');
    expect(highlights(text, 3, 9)).toHaveLength(2);
  });

  it('marks an ACL definition as Write and its condition uses as Read', () => {
    const text = [
      'frontend http',
      '    acl is_api path_beg /api',
      '    use_backend api if is_api',
    ].join('\n');
    const result = highlights(text, 1, 9);
    expect(result).toHaveLength(2);
    expect(result.filter((h) => h.kind === DocumentHighlightKind.Write)).toHaveLength(1);
  });

  it('returns an empty array when the cursor is not on a symbol', () => {
    expect(highlights(config, 1, 6)).toEqual([]);
  });

  it('returns an empty array on an empty line', () => {
    expect(highlights('frontend http\n\nbackend web', 1, 0)).toEqual([]);
  });
});
