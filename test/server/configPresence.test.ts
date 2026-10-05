import { HaproxyParser } from '../../server/src/parser/parser';
import { hasConfigSections } from '../../server/src/configPresence';

const parser = new HaproxyParser();

describe('hasConfigSections', () => {
  it('is true for a config with sections', () => {
    expect(hasConfigSections(parser.parse('global\n    maxconn 10\n', 'test://a.cfg'))).toBe(true);
  });

  it('is false for an nginx file forced to haproxy (parsed as an unknown section)', () => {
    const ast = parser.parse('server {\n    listen 80;\n}\n', 'test://nginx.conf');
    expect(ast.sections).toHaveLength(1);
    expect(hasConfigSections(ast)).toBe(false);
  });

  it('is false for a fragment with directives but no section', () => {
    const ast = parser.parse('    bind :80\n    default_backend web\n', 'test://frag.cfg');
    expect(hasConfigSections(ast)).toBe(false);
  });

  it('is false for an empty document', () => {
    expect(hasConfigSections(parser.parse('', 'test://empty.cfg'))).toBe(false);
  });
});
