import { HaproxyParser } from '../../server/src/parser/parser';
import { hasConfigSections } from '../../server/src/configPresence';

const parser = new HaproxyParser();

describe('hasConfigSections', () => {
  it('is true for a global section', () => {
    const text = 'global\n    maxconn 10\n';
    const ast = parser.parse(text, 'test://a.cfg');
    expect(hasConfigSections(ast, text)).toBe(true);
  });

  it('is false for an nginx file (listen header ends with semicolon)', () => {
    const text = 'server {\n    listen 80;\n}\n';
    const ast = parser.parse(text, 'test://nginx.conf');
    expect(hasConfigSections(ast, text)).toBe(false);
  });

  it('is false for a fragment with directives but no section', () => {
    const text = '    bind :80\n    default_backend web\n';
    const ast = parser.parse(text, 'test://frag.cfg');
    expect(hasConfigSections(ast, text)).toBe(false);
  });

  it('is false for an empty document', () => {
    const text = '';
    const ast = parser.parse(text, 'test://empty.cfg');
    expect(hasConfigSections(ast, text)).toBe(false);
  });

  it('is true for indented backend section (indented headers remain valid)', () => {
    const text = '    backend web\n        server a 10.0.0.1:80\n';
    const ast = parser.parse(text, 'test://indented.cfg');
    expect(hasConfigSections(ast, text)).toBe(true);
  });

  it('is true for section header with trailing comment', () => {
    const text = 'frontend fe # public\n    bind :80\n';
    const ast = parser.parse(text, 'test://commented.cfg');
    expect(hasConfigSections(ast, text)).toBe(true);
  });

  it('is true for CRLF line endings', () => {
    const text = 'global\r\n    maxconn 10\r\n';
    const ast = parser.parse(text, 'test://crlf.cfg');
    expect(hasConfigSections(ast, text)).toBe(true);
  });

  it('is false for a php-fpm pool with listen = socket', () => {
    const text = '[www]\nuser = www-data\nlisten = /run/php/php8.2-fpm.sock\n';
    const ast = parser.parse(text, 'test://www.conf');
    expect(hasConfigSections(ast, text)).toBe(false);
  });

  it('is false for key = value and key: value settings', () => {
    for (const text of ['cache = true\n', 'listen: 80\n', 'listen = *, ::\n']) {
      const ast = parser.parse(text, 'test://settings.conf');
      expect(hasConfigSections(ast, text)).toBe(false);
    }
  });

  it('is true for a listen section with a bind line', () => {
    const text = 'listen stats\n    bind :8404\n';
    const ast = parser.parse(text, 'test://stats.cfg');
    expect(hasConfigSections(ast, text)).toBe(true);
  });
});
