# Changelog

All notable changes to HAProxy Config extension will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
