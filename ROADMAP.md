# Roadmap

This roadmap is intentionally short. The extension is most useful when it stays fast, accurate, and focused on preventing HAProxy configuration mistakes.

## Current Status

- Syntax highlighting for HAProxy config files.
- Context-aware completion for sections, directives, actions, and common values.
- Version-aware validation for HAProxy 2.4, 2.6, 2.8, 3.0, and 3.1.
- Hover documentation with signatures and documentation links.
- Formatting, snippets, folding, symbols, go-to-definition, and quick fixes for deprecated directives.

## v1.0 Focus

- Improve directive coverage and version metadata accuracy.
- Expand real-world fixtures for HTTP, TCP, TLS, ACL, resolvers, peers, and stick-table configs.
- Keep diagnostics actionable and low-noise.
- Improve Marketplace presentation with up-to-date screenshots and concise demos.
- Keep CI reliable across Linux, Windows, and macOS.

## Contribution-Ready Work

- Add missing directive definitions with official HAProxy documentation links.
- Add validator tests for version-specific directives.
- Add real sanitized config fixtures.
- Improve snippets for common production patterns.
- Improve documentation for troubleshooting and local development.
- Improve README and Marketplace demos so more HAProxy users can discover the extension.

See [GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md) for starter tasks.

## Later Ideas

- Version change diagnostics that explain what breaks when switching HAProxy versions.
- Config diff tooling between HAProxy versions.
- More reference navigation for ACLs, maps, and backend references.
- Optional integration tests for larger real-world configs.
