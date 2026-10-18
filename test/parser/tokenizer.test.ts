import { readLogicalLine, tokenizeSegments } from '../../server/src/parser/tokenizer';

function tokenize(lines: string[], lineIndex = 0): { values: string[]; endLineIndex: number } {
  const logical = readLogicalLine(lines, lineIndex);
  if (!logical) throw new Error('expected a logical line');
  return {
    values: tokenizeSegments(logical.segments).map((t) => t.value),
    endLineIndex: logical.endLineIndex,
  };
}

describe('tokenizer', () => {
  it('returns undefined for blank and comment-only lines', () => {
    expect(readLogicalLine(['   '], 0)).toBeUndefined();
    expect(readLogicalLine(['  # just a comment'], 0)).toBeUndefined();
  });

  it('splits on whitespace and strips trailing comments', () => {
    expect(tokenize(['    bind *:80   ssl # listener']).values).toEqual(['bind', '*:80', 'ssl']);
  });

  it('keeps quoted values intact, unescaping and ignoring # inside quotes', () => {
    const { values } = tokenize([`    http-response set-header X-A "a b # \\"c\\"" 'd e'`]);
    expect(values).toEqual(['http-response', 'set-header', 'X-A', 'a b # "c"', 'd e']);
  });

  it('joins backslash continuation lines and reports the last consumed line', () => {
    const lines = ['frontend fe', '    bind \\', '        *:443 \\', '        ssl', '    mode http'];
    expect(tokenize(lines, 1)).toEqual({ values: ['bind', '*:443', 'ssl'], endLineIndex: 3 });
  });

  it('computes token ranges against the physical line', () => {
    const logical = readLogicalLine(['frontend fe', '    bind \\', '      *:80'], 1);
    const tokens = tokenizeSegments(logical?.segments ?? []);
    expect(tokens.map((t) => t.range)).toEqual([
      { startLine: 1, startCharacter: 4, endLine: 1, endCharacter: 8 },
      { startLine: 2, startCharacter: 6, endLine: 2, endCharacter: 10 },
    ]);
  });
});
