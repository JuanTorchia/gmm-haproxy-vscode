# Version Registry

**File:** `server/src/registry/versionRegistry.ts`

The `VersionRegistry` is the single access point for all directive knowledge. It combines the proxy directives (`directives.ts`) and global directives (`global.ts`) into a single, version-filtered map.

---

## Supported Versions

```
2.4 (LTS)  →  2.6 (LTS)  →  2.8 (LTS)  →  3.0 (Stable)  →  3.1 (Stable, default)
```

All version strings are the `KNOWN_VERSIONS` constant. The registry can accept any version string — unknown versions are resolved to the nearest lower known version.

---

## Core API

### `getDirectives(version: string): Map<string, DirectiveDefinition>`

Returns all directives valid for the given version as a `name → definition` map.

- **Keys are lowercase** for case-insensitive lookup.
- Results are **cached per resolved version**. The filter runs only once per version string.
- A directive is included if:
  - Its `since` version ≤ the requested version, AND
  - Its `removed` version is unset OR > the requested version

```typescript
const registry = new VersionRegistry();
const directives = registry.getDirectives('3.1');
console.log(directives.size); // ~180+ directives
```

### `getDirective(name: string, version: string): DirectiveDefinition | undefined`

Looks up a single directive by name. Case-insensitive.

```typescript
const def = registry.getDirective('balance', '3.1');
// → { name: 'balance', signature: '<algorithm> [<arguments>]', ... }
```

### `isAvailable(name: string, version: string): boolean`

Returns `true` if the directive exists and is not removed in this version.

```typescript
registry.isAvailable('reqrep', '2.4'); // false — removed in 2.1
registry.isAvailable('balance', '2.4'); // true
```

### `isDeprecated(name: string, version: string): boolean`

Returns `true` if the directive is deprecated (but not yet removed) in this version.

```typescript
registry.isDeprecated('redispatch', '3.1'); // true — deprecated in 2.4
```

### `resolveVersion(version: string): string`

Maps any version string to the nearest lower known version.

| Input | Output | Reason |
|-------|--------|--------|
| `'3.1'` | `'3.1'` | Exact match |
| `'2.9'` | `'2.8'` | Nearest lower known |
| `'1.9'` | `'2.4'` | Below all known → oldest |
| `'99.0'` | `'3.1'` | Above all known → newest |

### `compareVersions(a: string, b: string): number`

Compares two version strings numerically. Returns:
- Negative if `a < b`
- 0 if `a === b`
- Positive if `a > b`

Handles any number of dotted segments: `2.4`, `2.8.1`, `3.0.0` all work correctly.

---

## Filtering Logic

The filter inside `getDirectives()`:

```typescript
// Skip if introduced after this version
if (compareVersions(resolved, d.since) < 0) continue;

// Skip if fully removed at or before this version
if (d.removed && compareVersions(resolved, d.removed) >= 0) continue;
```

Note: deprecated directives are **included** in the map. `isDeprecated()` is a separate query — the directive is still valid, just flagged as deprecated in the validation and completion UI.

---

## Cache Behavior

The registry maintains an internal `Map<string, Map<string, DirectiveDefinition>>` — a map of resolved version → directive map.

```
resolveVersion('2.9') → '2.8'
cache.get('2.8') → hit (already built)
```

This means:
- First call to `getDirectives('3.1')` builds and caches the map.
- All subsequent calls return the same object reference — `O(1)`.
- Both `'2.9'` and `'2.8'` resolve to `'2.8'` and share the same cached map.

---

## Adding a New HAProxy Version

1. Add the version string to `KNOWN_VERSIONS` in `versionRegistry.ts`:
   ```typescript
   const KNOWN_VERSIONS = ['2.4', '2.6', '2.8', '3.0', '3.1', '3.2'] as const;
   ```
2. In `directives.ts` and `global.ts`, for any directive introduced in the new version, set `since: '3.2'`.
3. For directives removed in the new version, set `removed: '3.2'`.
4. Add test cases in `test/validator/validator.test.ts` for the new version's changes.

---

## Adding a New Directive

Add an entry to `DIRECTIVES` (proxy sections) or `GLOBAL_DIRECTIVES` (global section) following the `DirectiveDef` interface:

```typescript
{
  name: 'my-new-directive',
  signature: '<value> [optional-param]',
  description: 'One-line description of what this does.',
  sections: FLB,              // or use a custom SectionMatrix
  since: '3.2',
  category: 'connection',
  docsUrl: 'https://docs.haproxy.org/3.2/configuration.html#4.2-my-new-directive',
}
```

The registry picks it up automatically on next server start (or config reload). No code changes needed outside the data file.
