# Testing Guide

---

## Stack

| Tool | Role |
|------|------|
| **Jest** 29.7 | Test runner |
| **ts-jest** 29.2 | TypeScript transform (no separate compile step) |
| **@types/jest** 29.5 | Type definitions for `describe`/`it`/`expect` |
| `tsconfig.test.json` | Separate TS config with `"types": ["jest", "node"]` |

Tests run **without VSCode** — the language server modules are imported directly. VSCode and LSP modules are mocked.

---

## Running Tests

```bash
# All unit tests
npm run test:unit

# VSCode extension integration tests
npm run build
npm run test:integration

# Full local suite
npm test

# Single file
npx jest test/parser/parser.test.ts

# Watch mode
npx jest --watch
```

---

## Test File Locations

```
test/
├── __mocks__/
│   ├── vscode-languageserver.ts           — mock LSP enums (DiagnosticSeverity, etc.)
│   └── vscode-languageserver-textdocument.ts — mock TextDocument
├── parser/
│   └── parser.test.ts                     — HaproxyParser unit tests
└── validator/
    └── validator.test.ts                  — ValidationProvider unit tests
```

---

## Mocks

### `test/__mocks__/vscode-languageserver.ts`

Provides the LSP enum values that the server modules import from `vscode-languageserver/node`. Only the values actually used in production code are mocked.

```typescript
export const DiagnosticSeverity = { Error: 1, Warning: 2, Information: 3, Hint: 4 };
export const CompletionItemKind = { Keyword: 14, Property: 10, Value: 12, Reference: 18 };
export const CompletionItemTag = { Deprecated: 1 };
export const MarkupKind = { Markdown: 'markdown', PlainText: 'plaintext' };
```

The `moduleNameMapper` in `jest.config.js` redirects any import of `vscode-languageserver/node` to this mock file.

### `test/__mocks__/vscode-languageserver-textdocument.ts`

Provides a minimal `TextDocument` implementation for `FormattingProvider` tests (not yet written).

---

## What to Test

### Parser tests (`test/parser/parser.test.ts`)

Cover the following scenarios:

| Scenario | What to verify |
|----------|----------------|
| Empty input | Returns `{ sections: [], parseErrors: [] }` |
| Basic section | Section type, name, directive count |
| Multiple sections | All sections present, correct order |
| Inline comments | Stripped correctly, not misidentified as directives |
| Line continuation | `\` joins lines, resulting directive has correct args |
| Quoted strings | Quotes stripped from value, spaces in values preserved |
| Directive outside section | Appears in `parseErrors`, not in any section |
| Mode detection | `mode http` in section → `section.mode === 'http'` |
| Mode inheritance | `defaults mode tcp` → `frontend` inherits `mode: 'tcp'` |
| CRLF line endings | Parsed same as LF |
| Partial/broken config | No throw, best-effort AST |

### Validator tests (`test/validator/validator.test.ts`)

Cover the following scenarios:

| Scenario | Expected diagnostic |
|----------|---------------------|
| Valid directive in correct section | No diagnostic |
| Unknown directive | `Error`: "Unknown directive" |
| Directive in wrong section | `Error`: "not valid in 'X' section" |
| Removed directive (e.g. `reqrep` in 2.4) | `Error`: "removed in HAProxy X" |
| Deprecated directive | `Warning`: "deprecated since X" |
| `httpOnly` directive in TCP mode | `Error`: "requires HTTP mode" |
| `tcpOnly` directive in HTTP mode | `Error`: "requires TCP mode" |
| Parse errors in document | `Error`: forwarded from parser |
| > 100 diagnostics | Capped at 100 |
| Version fallback (e.g. `2.9` → `2.8`) | Directives for `2.8` are used |

---

## Coverage Requirements

Coverage is measured with `--coverage` and enforced in CI:

| Module | Line coverage | Function coverage |
|--------|--------------|-------------------|
| `server/src/parser/**` | ≥ 80% | ≥ 80% |
| `server/src/validation/**` | ≥ 80% | ≥ 80% |
| `server/src/registry/**` | ≥ 80% | ≥ 80% |

Coverage config in `jest.config.js`:
```javascript
collectCoverageFrom: [
  'server/src/parser/**/*.ts',
  'server/src/validation/**/*.ts',
  'server/src/registry/**/*.ts',
  '!**/*.d.ts',
],
coverageThreshold: {
  global: { lines: 80, functions: 80 }
}
```

---

## `tsconfig.test.json`

A dedicated TypeScript config for Jest, separate from the build configs. This is required because:
- The build `tsconfig.json` uses `composite: true` and `noEmit: false` — incompatible with ts-jest.
- Test files include `describe`/`it`/`expect` — requires `"types": ["jest", "node"]`.
- Test files span both `test/` and `server/src/` — both directories must be in `include`.

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "types": ["jest", "node"],
    "baseUrl": ".",
    "outDir": "./test-out"
  },
  "include": ["test/**/*.ts", "server/src/**/*.ts"]
}
```

---

## Adding a New Test File

1. Create `test/<area>/<name>.test.ts`
2. Import the class under test directly (not through the server):
   ```typescript
   import { HaproxyParser } from '../../server/src/parser/parser';
   ```
3. No VSCode, no LSP needed — just pure TypeScript.
4. If you need LSP types (e.g. `DiagnosticSeverity`), import from `vscode-languageserver/node` — jest.config.js will redirect to the mock automatically.

---

## CI

Tests run on every push and PR via GitHub Actions on three platforms:
- `ubuntu-latest`
- `windows-latest`
- `macos-latest`

The Windows run is particularly important because npm scripts use different quoting. All scripts use double quotes for Jest patterns: `jest --testPathPattern="test/(parser|validator)"`.
