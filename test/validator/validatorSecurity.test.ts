describe('security-sensitive validation', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('fs');
  });

  it('does not inspect filesystem paths from config content', async () => {
    const existsSync = jest.fn(() => false);
    jest.doMock('fs', () => ({ existsSync }));

    const { HaproxyParser } = await import('../../server/src/parser/parser');
    const { ValidationProvider } = await import('../../server/src/validation/validator');
    const { VersionRegistry } = await import('../../server/src/registry/versionRegistry');

    const parser = new HaproxyParser();
    const registry = new VersionRegistry();
    const doc = parser.parse([
      'global',
      '    module-path /untrusted/user/path',
      '    module-load waf.so',
      '    waf-load /untrusted/user/rules.conf',
    ].join('\n'), 'test://validate-security');

    new ValidationProvider(registry, '3.1').validate(doc);

    expect(existsSync).not.toHaveBeenCalled();
  });
});
