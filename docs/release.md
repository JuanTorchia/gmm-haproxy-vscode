# Release and Changelog Policy

This project publishes to two public surfaces:

- GitHub Releases, for maintainers and contributors.
- VS Code Marketplace, for extension users.

Both surfaces must be consistent with `CHANGELOG.md`.

## Changelog Rules

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every user-visible change must be added under `## [Unreleased]` in the same pull request that introduces it.

Use these sections only:

- `Added` — new user-facing features, commands, language support, snippets, diagnostics, or provider capabilities.
- `Changed` — changed behavior, defaults, UX, validation semantics, or supported workflows.
- `Deprecated` — supported behavior that will be removed later.
- `Removed` — removed behavior, settings, commands, snippets, or version support.
- `Fixed` — bug fixes and corrected behavior.
- `Security` — security fixes, hardening, dependency vulnerability fixes, or packaging safeguards.

Do not include:

- Internal refactors with no user or maintainer impact.
- Dependency bumps unless they fix security issues or affect runtime behavior.
- Vague entries such as "misc fixes", "cleanup", or "updates".

Good entries are specific and explain the user impact:

```markdown
### Fixed
- Prevent `use_backend` references from warning when the target is a `listen` section.
```

Bad entries hide the impact:

```markdown
### Fixed
- Fix validation.
```

## Version Rules

Use semantic versioning:

- `MAJOR` for breaking changes or dropping supported VS Code / HAProxy versions.
- `MINOR` for new features, new provider capabilities, new directive coverage, or new validation rules.
- `PATCH` for bug fixes, documentation fixes, packaging fixes, and security patches that do not change public behavior incompatibly.

Before creating a release tag:

1. Move relevant `Unreleased` entries into `## [X.Y.Z] — YYYY-MM-DD`.
2. Ensure `package.json.version` is exactly `X.Y.Z`.
3. Ensure the tag is exactly `vX.Y.Z`.
4. Ensure `CHANGELOG.md` has no placeholder entries.

## GitHub Release Notes

GitHub release notes should be concise and contributor-oriented.

Required structure:

```markdown
## Highlights

- One to three bullets describing the most important user-visible changes.

## Changes

- Summarized from CHANGELOG.md.

## Validation

- CI workflow link or short list of release checks.
```

GitHub release notes may mention contributors, internal maintenance, and security hardening when relevant.

## VS Code Marketplace Release Notes

Marketplace release notes should be user-oriented and written in English.

Rules:

- Lead with practical editor impact.
- Avoid internal implementation detail unless it helps users understand behavior.
- Mention required user action, if any.
- Mention HAProxy version support changes explicitly.
- Keep the text short enough to scan in under one minute.

Recommended structure:

```markdown
### HAProxy Config X.Y.Z

- Added ...
- Fixed ...
- Improved ...
```

## Release Gate

Do not publish unless all checks pass:

- `npm run lint`
- `npm run compile`
- `npm run test:unit`
- `npm audit --audit-level=high`
- `npm run build`
- `npx vsce package --no-dependencies`
- Package inspection confirms no secrets, local-only files, source maps, test files, or generated junk are bundled.

Publishing must happen from GitHub Actions, not from a local machine.

## Packaging Safety

Before publishing, inspect package contents with:

```bash
npx vsce ls --tree
```

The package must not include:

- `.env` or `.env.*`
- `serviceaccount.json`, `service-account.json`, or `serviceaccout.json`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`
- `node_modules/`
- test files
- source maps
- local agent scratch files

If package contents are wrong, fix `.vscodeignore` before publishing.
