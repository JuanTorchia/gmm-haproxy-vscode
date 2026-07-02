# Changelog

All notable changes to HAProxy Config extension will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release notes for GitHub and VS Code Marketplace must be derived from this file.
See [docs/release.md](docs/release.md) for changelog and release-note rules.

## [Unreleased]

### Added
- Release and changelog policy documenting how GitHub Release notes and VS Code Marketplace notes must be derived from `CHANGELOG.md`.

## [0.2.0] — 2026-06-30 ([@RevLaw](https://github.com/RevLaw))

### Added
- **Named defaults sections**: `defaults http` syntax supported — section name highlighted, `from <name>` clause highlighted as keyword + type; grammar, parser, and AST all updated
- **Go to Definition / Find References / Peek** for all named cross-references:
  - Backends / listen — `use_backend`, `default_backend`, section headers
  - ACLs — `acl <name>` definitions ↔ `if`/`unless` conditions (including negated `!name`), section-scoped
  - Servers — `server <name>` ↔ `use-server <name>`, section-scoped
  - Named defaults — `from <name>` ↔ `defaults <name>` section
  - Cache — `cache <name>` ↔ `http-request cache-use` / `http-response cache-store`
  - Userlist — `userlist <name>` ↔ `http_auth(<name>)` / `http_auth_group(<name>)`, precise sub-range
  - Resolvers — `resolvers <name>` ↔ `resolvers` param in `server` lines
  - Peers — `peers <name>` ↔ `stick-table … peers <name>`
- **Document highlights** for all symbol types above (definition in green, references in blue)
- **Rename symbol** (F2) for all symbol types — ACL negation `!name` renames name-only
- **Smart cross-reference completions**: `use_backend`, `default_backend`, `from`, `if`/`unless`, `use-server`, `cache-use`, `cache-store`, `resolvers`, `stick-table peers` all offer IntelliSense lists from the current file
- **Cross-reference validation**:
  - `from <name>` referencing undefined named defaults → Warning
  - `use-server <name>` with no matching server in section → Error
  - `http-request cache-use` / `http-response cache-store` with undefined cache → Warning
- **Unreferenced-symbol diagnostics**:
  - Backend never referenced by `use_backend`/`default_backend` → Information
  - Named defaults never referenced by `from` → Information
  - ACL defined but never used in `if`/`unless` → Information
  - SPOE backends (name contains `spoe`) are exempt
- **HAProxy Enterprise (HAPEE) module support**:
  - `module-path`, `module-load`, `waf-load` recognized as valid global directives
  - `module-path` directory existence validated → Warning if missing
  - `module-load` file existence validated against `module-path` → Warning if missing
  - `waf-load` file existence validated → Warning if missing

### Changed
- `DefinitionProvider` rewritten to delegate to shared `symbolResolver`
- `HaproxySection` AST now carries `nameToken` and `from` token with source ranges
- Mode inheritance now resolves correctly through named defaults `from` chains
- `symbolResolver` moved to `shared/` — eliminates cross-provider directory imports

## [0.1.2] — 2026-04-06

### Fixed
- README images not showing on Marketplace (private repo — switched to absolute
  raw.githubusercontent.com URLs from public assets repo)
- Fixed repository.url in package.json pointing to old `gmm/` organization

## [0.1.1] — 2026-04-06

### Fixed
- Document symbols (Outline panel) crashed with `TypeError: Cannot read properties of undefined (reading 'range')` — caused by using `Number.MAX_SAFE_INTEGER` as a character position, which exceeds the LSP `uinteger` max of `2147483647`
- `option forceclose` had no data entry — deprecation warning was never generated, making the quick fix silently unavailable
- Added smoke test: every entry in `SAFE_REPLACEMENTS` is now verified to produce a real deprecation warning at test time

### Changed
- README updated with real screenshots for all features
- Settings panel screenshot added to Configuration section
- CI badge URL corrected to `JuanTorchia/gmm-haproxy-vscode`

## [0.1.0] — 2026-04-05

### Added
- Initial release
- HAProxy config parser: fault-tolerant AST with source ranges for every token
- Syntax highlighting via TextMate grammar (section headers, directives, ACLs, IPs, timeouts, strings)
- Context-aware autocompletion filtered by section type and `mode http`/`mode tcp`
- Hover documentation: signature, description, valid sections, version badge, docs link
- Live validation with version-aware diagnostics:
  - Unknown directives (Error)
  - Directive used in wrong section (Error)
  - HTTP-only directive in `mode tcp` section (Error), and vice versa
  - Deprecated directives with migration hints (Warning)
  - Directives not available in the selected version (Error)
  - Invalid `http-request`, `http-response`, `http-after-response`, `tcp-request`, `tcp-response` action sub-keywords (Error)
  - `use_backend` / `default_backend` referencing an undefined backend (Warning)
- Document formatting: 4-space indentation normalization
- Snippets for all common HAProxy blocks (`global`, `defaults`, `frontend`, `backend`, `listen`, `server`, `acl`, `httpchk`, `use_backend`)
- Multi-version support: 2.4 LTS, 2.6 LTS, 2.8 LTS, 3.0, 3.1
- Status bar version indicator with QuickPick selector
- `HAProxy: Select Version` and `HAProxy: Restart Language Server` commands
- Server/default-server parameter completions
- GitHub Actions CI workflow (lint, type-check, unit tests, integration tests, packaging)
- Marketplace publish workflow triggered on `v*.*.*` tags
