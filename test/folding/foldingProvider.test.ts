import { HaproxyParser } from '../../server/src/parser/parser';
import { FoldingProvider } from '../../server/src/folding/foldingProvider';

const parser = new HaproxyParser();
const provider = new FoldingProvider();

function getFolds(text: string) {
  const doc = parser.parse(text, 'test://folding');
  return provider.provideFoldingRanges(doc);
}

describe('FoldingProvider', () => {
  it('returns empty array for empty document', () => {
    expect(getFolds('')).toHaveLength(0);
  });

  it('returns one range for a single section', () => {
    const text = 'backend web\n    balance roundrobin\n    server s1 10.0.0.1:80\n';
    const folds = getFolds(text);
    expect(folds).toHaveLength(1);
  });

  it('fold starts at the section header line', () => {
    const folds = getFolds('backend web\n    balance roundrobin\n');
    expect(folds[0]?.startLine).toBe(0);
  });

  it('fold ends at the last directive line for the final section', () => {
    const text = 'backend web\n    balance roundrobin\n    server s1 10.0.0.1:80\n';
    const folds = getFolds(text);
    expect(folds[0]?.endLine).toBe(2);
  });

  it('returns one range per section', () => {
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
    const folds = getFolds(text);
    expect(folds).toHaveLength(4);
  });

  it('first section fold ends before the next section starts', () => {
    const text = 'frontend http\n    bind *:80\n\nbackend web\n    balance roundrobin\n';
    const folds = getFolds(text);
    expect(folds[0]?.endLine).toBeLessThan(folds[1]!.startLine);
  });

  it('fold kind is Region', () => {
    const folds = getFolds('backend web\n    balance roundrobin\n');
    expect(folds[0]?.kind).toBe('region');
  });

  it('section with only a header (no directives) produces no fold', () => {
    // Header alone → startLine === endLine → filtered out
    const folds = getFolds('backend web\n');
    expect(folds).toHaveLength(0);
  });
});
