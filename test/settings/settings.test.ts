import { DEFAULT_SETTINGS, parseServerSettings } from '../../server/src/settings';

describe('parseServerSettings', () => {
  it('reads nested VS Code configuration values', () => {
    const settings = parseServerSettings({
      version: '2.8',
      validate: { enable: false },
      completion: { enable: false },
    });

    expect(settings).toEqual({
      version: '2.8',
      validationEnabled: false,
      completionEnabled: false,
    });
  });

  it('falls back to flat keys for non-VS Code clients', () => {
    const settings = parseServerSettings({
      version: '3.0',
      'validate.enable': false,
      'completion.enable': false,
    });

    expect(settings).toEqual({
      version: '3.0',
      validationEnabled: false,
      completionEnabled: false,
    });
  });

  it('uses defaults for malformed values', () => {
    const settings = parseServerSettings({
      version: 31,
      validate: { enable: 'false' },
      completion: { enable: null },
    });

    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('uses defaults when config is not an object', () => {
    expect(parseServerSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseServerSettings('haproxy')).toEqual(DEFAULT_SETTINGS);
  });
});
