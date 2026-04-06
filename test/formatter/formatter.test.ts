import { FormattingProvider } from '../../server/src/formatting/formatter';
import { TextDocument } from '../__mocks__/vscode-languageserver-textdocument';

const provider = new FormattingProvider();

const opts = { tabSize: 4, insertSpaces: true };

function format(text: string): string | null {
  const doc = TextDocument.create('test://format', 'haproxy', 1, text);
  const edits = provider.format(doc as never, opts);
  if (edits.length === 0) return null; // no changes
  return edits[0]?.newText ?? null;
}

describe('FormattingProvider', () => {
  describe('already-formatted input', () => {
    it('returns no edits when input is already correct', () => {
      const text = 'backend web\n    balance roundrobin\n';
      const doc = TextDocument.create('test://noop', 'haproxy', 1, text);
      const edits = provider.format(doc as never, opts);
      expect(edits).toHaveLength(0);
    });

    it('returns no edits for empty document', () => {
      const doc = TextDocument.create('test://empty', 'haproxy', 1, '');
      const edits = provider.format(doc as never, opts);
      expect(edits).toHaveLength(0);
    });
  });

  describe('indentation normalization', () => {
    it('converts 2-space indent to 4-space', () => {
      const result = format('backend web\n  balance roundrobin\n');
      expect(result).toBe('backend web\n    balance roundrobin\n');
    });

    it('converts tab indent to 4-space', () => {
      const result = format('backend web\n\tbalance roundrobin\n');
      expect(result).toBe('backend web\n    balance roundrobin\n');
    });

    it('converts 8-space indent to 4-space', () => {
      const result = format('backend web\n        balance roundrobin\n');
      expect(result).toBe('backend web\n    balance roundrobin\n');
    });

    it('respects tabSize option', () => {
      // Input has 4-space indent; with tabSize 2 the formatter should reindent to 2 spaces
      const doc = TextDocument.create('test://tabs', 'haproxy', 1, 'backend web\n    balance roundrobin\n');
      const edits = provider.format(doc as never, { tabSize: 2, insertSpaces: true });
      expect(edits[0]?.newText).toBe('backend web\n  balance roundrobin\n');
    });

    it('uses tabs when insertSpaces is false', () => {
      const doc = TextDocument.create('test://usetabs', 'haproxy', 1, 'backend web\n    balance roundrobin\n');
      const edits = provider.format(doc as never, { tabSize: 4, insertSpaces: false });
      expect(edits[0]?.newText).toBe('backend web\n\tbalance roundrobin\n');
    });
  });

  describe('section headers at column 0', () => {
    it('moves indented section header to column 0', () => {
      const result = format('  backend web\n    balance roundrobin\n');
      expect(result).toContain('backend web\n');
      expect(result).not.toMatch(/^ +backend/);
    });

    it('handles all section types at column 0', () => {
      const sections = ['global', 'defaults', 'frontend', 'backend', 'listen',
        'userlist', 'peers', 'resolvers', 'mailers', 'ring',
        'log-forward', 'program', 'http-errors', 'cache'];
      for (const s of sections) {
        const result = format(`  ${s} test\n    maxconn 1000\n`);
        expect(result).toMatch(new RegExp(`^${s}`, 'm'));
      }
    });
  });

  describe('blank line normalization', () => {
    it('collapses multiple blank lines between sections to one', () => {
      const text = 'backend web\n    balance roundrobin\n\n\n\nbackend api\n    balance leastconn\n';
      const result = format(text);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('preserves single blank line between sections', () => {
      const text = 'backend web\n    balance roundrobin\n\nbackend api\n    balance leastconn\n';
      const doc = TextDocument.create('test://blanks', 'haproxy', 1, text);
      const edits = provider.format(doc as never, opts);
      expect(edits).toHaveLength(0);
    });

    it('strips trailing blank lines', () => {
      const result = format('backend web\n    balance roundrobin\n\n\n');
      expect(result).toBe('backend web\n    balance roundrobin\n');
    });
  });

  describe('comment handling', () => {
    it('indents inline comment lines inside a section', () => {
      const result = format('backend web\n# a comment\n    balance roundrobin\n');
      expect(result).toContain('    # a comment');
    });

    it('preserves comment at column 0 before any section', () => {
      // This input is already correctly formatted — no edits should be emitted
      const doc = TextDocument.create('test://comment-top', 'haproxy', 1,
        '# top-level comment\nbackend web\n    balance roundrobin\n');
      const edits = provider.format(doc as never, opts);
      expect(edits).toHaveLength(0);
    });

    it('preserves inline # comments on directive lines', () => {
      const text = 'backend web\n    balance roundrobin # pick a server\n';
      const doc = TextDocument.create('test://inline', 'haproxy', 1, text);
      const edits = provider.format(doc as never, opts);
      expect(edits).toHaveLength(0);
    });
  });

  describe('full document formatting', () => {
    it('formats a realistic backend section', () => {
      const input = [
        'backend web',
        '  balance roundrobin',
        '  option httpchk GET /health',
        '  server s1 10.0.0.1:80 check',
      ].join('\n') + '\n';
      const result = format(input);
      expect(result).toBe([
        'backend web',
        '    balance roundrobin',
        '    option httpchk GET /health',
        '    server s1 10.0.0.1:80 check',
      ].join('\n') + '\n');
    });

    it('formats multiple sections', () => {
      const input = [
        '  defaults',
        '  mode http',
        '',
        '  backend web',
        '  balance roundrobin',
      ].join('\n') + '\n';
      const result = format(input);
      // Section headers must be at column 0
      expect(result).toMatch(/^defaults$/m);
      expect(result).toMatch(/^backend web$/m);
      // Directives must be indented
      expect(result).toContain('    mode http');
      expect(result).toContain('    balance roundrobin');
    });

    it('handles CRLF line endings by normalizing to LF', () => {
      const result = format('backend web\r\n    balance roundrobin\r\n');
      // Result uses LF only
      expect(result).not.toContain('\r\n');
    });
  });
});
