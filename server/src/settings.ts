/** Server-side settings mirroring the contributes.configuration entries. */
export interface ServerSettings {
  version: string;
  validationEnabled: boolean;
  completionEnabled: boolean;
}

export const DEFAULT_SETTINGS: ServerSettings = {
  version: '3.1',
  validationEnabled: true,
  completionEnabled: true,
};

/** Normalize raw LSP configuration into server settings. */
export function parseServerSettings(config: unknown): ServerSettings {
  if (!isRecord(config)) return { ...DEFAULT_SETTINGS };

  return {
    version: readString(config, 'version') ?? DEFAULT_SETTINGS.version,
    validationEnabled:
      readNestedBoolean(config, 'validate', 'enable') ??
      readBoolean(config, 'validate.enable') ??
      DEFAULT_SETTINGS.validationEnabled,
    completionEnabled:
      readNestedBoolean(config, 'completion', 'enable') ??
      readBoolean(config, 'completion.enable') ??
      DEFAULT_SETTINGS.completionEnabled,
  };
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readNestedBoolean(
  record: Record<string, unknown>,
  parentKey: string,
  childKey: string
): boolean | undefined {
  const parent = record[parentKey];
  if (!isRecord(parent)) return undefined;
  return readBoolean(parent, childKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
