import { HaproxyParser } from '../../server/src/parser/parser';

describe('HaproxyParser', () => {
  const parser = new HaproxyParser();

  it('parses an empty document', () => {
    const doc = parser.parse('', 'test://empty');
    expect(doc.sections).toHaveLength(0);
    expect(doc.parseErrors).toHaveLength(0);
  });

  it('parses a global section', () => {
    const text = `global\n    daemon\n    maxconn 50000\n`;
    const doc = parser.parse(text, 'test://global');
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]?.type).toBe('global');
    expect(doc.sections[0]?.directives).toHaveLength(2);
  });

  it('parses frontend and backend sections', () => {
    const text = [
      'frontend http-in',
      '    bind *:80',
      '    default_backend web',
      '',
      'backend web',
      '    server web1 10.0.0.1:8080 check',
    ].join('\n');
    const doc = parser.parse(text, 'test://fb');
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0]?.type).toBe('frontend');
    expect(doc.sections[0]?.name).toBe('http-in');
    expect(doc.sections[1]?.type).toBe('backend');
    expect(doc.sections[1]?.name).toBe('web');
  });

  it('strips inline comments', () => {
    const text = `global\n    maxconn 50000 # this is a comment\n`;
    const doc = parser.parse(text, 'test://comment');
    const directive = doc.sections[0]?.directives[0];
    expect(directive?.keyword.value).toBe('maxconn');
    expect(directive?.args[0]?.value).toBe('50000');
  });

  it('handles continuation lines', () => {
    const text = `frontend http-in\n    bind *:80 \\\n        *:8080\n`;
    const doc = parser.parse(text, 'test://continuation');
    const directive = doc.sections[0]?.directives[0];
    expect(directive?.keyword.value).toBe('bind');
    expect(directive?.args).toHaveLength(2);
  });

  it('reports directive outside section as parse error', () => {
    const text = `maxconn 50000\n`;
    const doc = parser.parse(text, 'test://outside');
    expect(doc.parseErrors).toHaveLength(1);
    expect(doc.parseErrors[0]?.message).toMatch(/outside of any section/);
  });

  it('resolves mode from defaults section', () => {
    const text = [
      'defaults',
      '    mode http',
      '',
      'frontend http-in',
      '    bind *:80',
    ].join('\n');
    const doc = parser.parse(text, 'test://mode');
    const frontend = doc.sections.find((s) => s.type === 'frontend');
    expect(frontend?.mode).toBe('http');
  });

  it('handles quoted string arguments', () => {
    const text = `backend web\n    http-request set-header X-Custom "hello world"\n`;
    const doc = parser.parse(text, 'test://quoted');
    const directive = doc.sections[0]?.directives[0];
    expect(directive?.args).toHaveLength(3);
    expect(directive?.args[2]?.value).toBe('hello world');
  });

  it('handles single-quoted string arguments', () => {
    const text = `backend web\n    http-request set-header X-Custom 'hello world'\n`;
    const doc = parser.parse(text, 'test://single-quoted');
    const directive = doc.sections[0]?.directives[0];
    expect(directive?.args[2]?.value).toBe('hello world');
  });

  it('handles escaped characters inside quoted strings', () => {
    const text = `backend web\n    http-request set-header X-Msg "hello \\"world\\""\n`;
    const doc = parser.parse(text, 'test://escape');
    const directive = doc.sections[0]?.directives[0];
    // Value should have the escaped quotes stripped
    expect(directive?.args[2]?.value).toContain('world');
  });

  it('stores token ranges with correct column offsets', () => {
    // 'balance' starts at col 4 (4 spaces indentation)
    const text = 'backend web\n    balance roundrobin\n';
    const doc = parser.parse(text, 'test://range');
    const directive = doc.sections[0]?.directives[0];
    expect(directive?.keyword.range.startCharacter).toBe(4);
    expect(directive?.keyword.range.endCharacter).toBe(11);
  });

  it('handles CRLF line endings', () => {
    const text = 'backend web\r\n    balance roundrobin\r\n';
    const doc = parser.parse(text, 'test://crlf');
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]?.directives[0]?.keyword.value).toBe('balance');
  });

  it('ignores comment-only lines', () => {
    const text = 'backend web\n    # this is a comment\n    balance roundrobin\n';
    const doc = parser.parse(text, 'test://comment-line');
    expect(doc.sections[0]?.directives).toHaveLength(1);
    expect(doc.sections[0]?.directives[0]?.keyword.value).toBe('balance');
  });
});
