# Contributing to HAProxy Config

Thank you for considering a contribution. This project is useful when it stays accurate, fast, and focused on preventing HAProxy configuration mistakes.

Good first places to start:

- [Good first issues](GOOD_FIRST_ISSUES.md)
- [Roadmap](ROADMAP.md)
- [Support guide](SUPPORT.md)
- [Release and changelog policy](docs/release.md)

---

## Development Setup

**Requirements:** Node.js 24.x, npm 10+

```bash
git clone https://github.com/JuanTorchia/gmm-haproxy-vscode
cd gmm-haproxy-vscode
npm ci
npm ci --legacy-peer-deps --prefix client
npm ci --legacy-peer-deps --prefix server
```

**Run the extension in VSCode:**

Press `F5` — this opens an Extension Development Host with the extension loaded. Open any `.cfg` file to activate it.

**Compile (type-check only):**

```bash
npm run compile
```

**Build bundles (esbuild):**

```bash
npm run build
```

**Watch mode (auto-rebuild on save):**

```bash
npm run watch
```

---

## Running Tests

```bash
npm run test:unit         # parser, validator, completion, hover, grammar, formatter
npm run test:integration  # VSCode extension activation + LSP handshake
npm test                  # both
```

For small documentation-only changes, run:

```bash
git diff --check
```

For directive data or validation changes, run the focused validator suite first:

```bash
npm run test:unit -- test/validator/validator.test.ts
```

**Coverage:**

```bash
npm run test:unit -- --coverage
```

Target: 80% lines and functions on parser, validator, completion, hover, formatter, registry.

---

## Project Layout

```
client/src/extension.ts        Thin LSP client — no business logic
server/src/server.ts           Language server entry point
server/src/parser/             Fault-tolerant config parser → AST
server/src/validation/         Diagnostic rules
server/src/completion/         Completion provider
server/src/hover/              Hover provider
server/src/formatting/         Document formatter
server/src/registry/           Version-aware directive registry
server/src/data/               HAProxy directive definitions (TypeScript data files)
syntaxes/                      TextMate grammar
snippets/                      Snippet definitions
test/                          Unit and integration tests
test/fixtures/                 Real HAProxy config files used in tests
```

---

## Adding a New Directive

1. Open `server/src/data/directives.ts` (proxy directives) or `server/src/data/global.ts` (global section).
2. Add an entry following the existing pattern — include `name`, `signature`, `description`, `sections`, `since`, and optionally `deprecated`, `removed`, `httpOnly`, `tcpOnly`, `docsUrl`.
3. Add a test in `test/validator/validator.test.ts` that validates the directive in its correct section and, if applicable, in a wrong section.
4. Link to official HAProxy documentation in `docsUrl`.
5. Keep descriptions short enough to be useful in completion and hover UI.

If you are not sure where to start, open a directive data issue and include the official HAProxy docs URL.

---

## Commit Convention

Format: `type(scope): short description`

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `test` | Adding or fixing tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `chore` | Build, CI, dependencies |

Example: `fix(parser): handle continuation lines at end of file`

All commits must pass: `npm run lint && npm run compile && npm run test:unit`.

---

## Changelog and Release Notes

Every user-visible change must update `CHANGELOG.md` under `## [Unreleased]` in the same pull request.

User-visible means the change affects extension behavior, diagnostics, completions, hover text, formatting, snippets, supported HAProxy versions, packaging, Marketplace presentation, release automation, or security posture.

Do not add changelog entries for internal refactors unless maintainers or contributors need to know about the change.

Before a release, maintainers move `Unreleased` entries into a versioned section and derive both GitHub Release notes and VS Code Marketplace notes from `CHANGELOG.md`.

See [docs/release.md](docs/release.md) for the full policy.

---

## Pull Request Checklist

- [ ] `npm run lint` passes
- [ ] `npm run compile` passes
- [ ] `npm run test:unit` passes
- [ ] `CHANGELOG.md` updated, or the PR is internal-only and does not need a changelog entry
- [ ] New directives have validator tests
- [ ] New language features have unit tests
- [ ] Coverage stays above 80% on modified modules
- [ ] No production secrets, certificates, tokens, or internal configs are included

---

## Code Style

- TypeScript strict mode — no `any`, no `as unknown as X` workarounds
- Max file length: 300 lines. Max function length: 40 lines.
- No `console.log` in production code — use `connection.console.log()` server-side
- All exported symbols need JSDoc with `@param` and `@returns`

---

## Reporting Bugs

Open an issue at [github.com/JuanTorchia/gmm-haproxy-vscode/issues](https://github.com/JuanTorchia/gmm-haproxy-vscode/issues) with:
- VSCode version
- Extension version
- HAProxy version setting
- The HAProxy config snippet that triggers the issue
- Expected vs actual behavior

Use a minimal sanitized config. Do not include production secrets, private keys, certificates, tokens, internal hostnames, or full production configs.

Security vulnerabilities should be reported privately. See [SECURITY.md](SECURITY.md).
