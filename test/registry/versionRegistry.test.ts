import { VersionRegistry } from '../../server/src/registry/versionRegistry';

describe('VersionRegistry stick-table metadata', () => {
  const registry = new VersionRegistry();

  it('exposes docs links for stick-table and stick rule directives', () => {
    const directives = [
      'stick-table',
      'stick on',
      'stick match',
      'stick store-request',
      'stick store-response',
    ];

    for (const name of directives) {
      const def = registry.getDirective(name, '3.1');

      expect(def?.docsUrl).toBe('https://docs.haproxy.org/3.1/configuration.html#stick-table');
    }
  });
});
