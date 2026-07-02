# Development Guide

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24.x LTS | `node --version` |
| npm | ≥ 10 | Comes with Node 24 |
| VSCode | ≥ 1.110.0 | For local extension testing |
| TypeScript | 6.0 | Installed as devDependency — no global install needed |

---

## First-Time Setup

```bash
# Clone the repo
git clone <repo-url>
cd gmm-haproxy-vscode

# Install all workspace dependencies (root + client + server)
npm ci
npm ci --legacy-peer-deps --prefix client
npm ci --legacy-peer-deps --prefix server
```

> **Note:** `--legacy-peer-deps` is required because TypeScript 6.x has not yet been formally tested with ts-jest 29.x. The combination works in practice.

---

## Project Structure

```
gmm-haproxy-vscode/
├── client/                     VSCode extension host (thin client)
│   ├── src/extension.ts        Entry point — activates on onLanguage:haproxy
│   ├── package.json
│   └── tsconfig.json
├── server/                     Language server (all intelligence lives here)
│   ├── src/
│   │   ├── server.ts           LSP server entry point
│   │   ├── parser/             Lexer + parser → AST
│   │   ├── validation/         ValidationProvider
│   │   ├── completion/         CompletionProvider
│   │   ├── hover/              HoverProvider
│   │   ├── formatting/         FormattingProvider
│   │   ├── registry/           VersionRegistry (version-aware directive lookup)
│   │   └── data/               Directive definitions (pure data, no logic)
│   ├── package.json
│   └── tsconfig.json
├── test/                       Jest unit tests (run without VSCode)
│   ├── __mocks__/              Mock implementations of vscode-languageserver-*
│   ├── parser/
│   └── validator/
├── syntaxes/                   TextMate grammar for syntax highlighting
├── snippets/                   VSCode snippet definitions
├── docs/                       This documentation
├── .github/workflows/          CI and publish pipelines
├── jest.config.js
├── tsconfig.json               References-only root (composite build)
├── tsconfig.test.json          ts-jest specific config
└── package.json                Extension manifest + root scripts
```

---

## NPM Scripts

All scripts are run from the **repository root**.

| Script | Command | Description |
|--------|---------|-------------|
| `npm run compile` | `tsc -b` | Type-check all TypeScript (no emit). Fast feedback on type errors. |
| `npm run build` | `node esbuild.config.js` | Bundle client + server with esbuild for production. |
| `npm run watch` | esbuild watch | Rebuild on file change (dev mode). |
| `npm run lint` | `eslint . --ext .ts` | Run ESLint across all TypeScript files. |
| `npm run test:unit` | jest | Run parser and validator unit tests. |
| `npm test` | jest + coverage | Full test run with coverage report. |

---

## Development Workflow

### 1. Type-check (fast loop)

```bash
npm run compile
```

No output = no type errors. Use this constantly while writing code.

### 2. Run tests

```bash
npm run test:unit
```

19 tests, ~4 seconds. Run after any change to parser, validator, or registry.

### 3. Test in VSCode

```bash
npm run build
```

Then press `F5` in VSCode (or use the **Run Extension** launch config). This opens a new Extension Development Host window with the extension loaded.

### 4. Lint

```bash
npm run lint
```

ESLint with `@typescript-eslint` strict rules. CI blocks merge on lint errors.

---

## ESLint Configuration (`.eslintrc.json`)

Key rules enforced:
- `@typescript-eslint/no-explicit-any` — no `any` types
- `@typescript-eslint/explicit-function-return-type` — all functions must declare return type
- `@typescript-eslint/no-unused-vars` — no dead variables
- `no-console` — use `connection.console.log()` server-side

---

## TypeScript Configuration

### Build configs

- **Root** `tsconfig.json` — references-only, coordinates composite build
- **`client/tsconfig.json`** — targets `ES2022`, module `commonjs`, `strict: true`, `composite: true`
- **`server/tsconfig.json`** — same as client

### Test config

- **`tsconfig.test.json`** — adds `"types": ["jest", "node"]`, includes `test/**` and `server/src/**`

The root `tsconfig.json` is **references-only** (`"files": []`). This is intentional — it tells `tsc -b` to compile client and server as separate composite projects. If you add it to `include`, TypeScript will try to compile all source files together and fail with TS5055 (cannot write to output file).

---

## esbuild Bundles

Two separate bundles:

```
client/src/extension.ts  →  client/out/extension.js   (Extension Host)
server/src/server.ts     →  server/out/server.js       (Node.js child process)
```

Settings:
- Platform: `node`
- Format: `commonjs`
- Target: `node20`
- Source maps: included in dev, excluded in production
- External: `vscode` (provided by the extension host), `vscode-languageserver-*`

---

## Adding a New Language Feature

### 1. New provider

Create a class in the appropriate directory:

```
server/src/<feature>/<feature>Provider.ts
```

The class must:
- Accept `VersionRegistry` and `version: string` in its constructor
- Accept a `HaproxyDocument` and LSP position/range as inputs
- Return LSP-typed results (e.g. `CodeAction[]`, `Location[]`)
- Have no dependency on other providers

### 2. Register in server.ts

```typescript
// In onInitialize capabilities:
codeActionProvider: true,

// Add handler:
connection.onCodeAction((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const ast = getOrParseDocument(doc);
  return codeActionProvider.provideCodeActions(ast, params.range, params.context);
});
```

### 3. Add tests

Create `test/<feature>/<feature>.test.ts`. Import the provider directly, pass a `HaproxyDocument` built by `HaproxyParser`, assert on the returned LSP objects.

---

## Debugging the Language Server

Add this to `.vscode/launch.json` to attach the Node.js debugger to the language server process:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Language Server",
  "port": 6009,
  "restart": true,
  "outFiles": ["${workspaceFolder}/server/out/**/*.js"]
}
```

Then start the extension with `F5` and attach the debugger to port 6009.

Alternatively, set `haproxy.trace.server` to `"verbose"` in your VSCode settings to log all LSP messages to the Output channel.

---

## Git Conventions

```
feat(scope): description      — new feature
fix(scope): description       — bug fix
test(scope): description      — test changes
refactor(scope): description  — code restructure, no behavior change
perf(scope): description      — performance improvement
chore(scope): description     — deps, build, tooling
docs(scope): description      — documentation only
```

All commits authored as **Juan Torchia \<j.s.torchia@gmail.com\>**.

---

## Release Checklist

Before tagging a release:

- [ ] `npm run compile` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes with ≥ 80% coverage
- [ ] `npm audit --audit-level=high` passes
- [ ] `CHANGELOG.md` updated
- [ ] `package.json` version bumped (semver)
- [ ] `vsce ls` reviewed — no sensitive files bundled
- [ ] `npm run build` produces valid `.vsix`

Tag format: `v1.0.0`. The publish workflow triggers automatically on tags matching `v*.*.*`.
