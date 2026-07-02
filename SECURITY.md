# Security Policy

## Supported Versions

Security fixes are prioritized for the latest published extension version and the current `main` branch.

| Version | Supported |
| --- | --- |
| Latest Marketplace release | Yes |
| `main` branch | Yes |
| Older releases | Best effort |

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Report security concerns through GitHub private vulnerability reporting when available, or contact the maintainer listed in `package.json`.

Include:

- A short description of the issue and expected impact.
- Steps to reproduce with a minimal sanitized HAProxy config.
- Extension version, VS Code version, and operating system.
- Whether the issue can expose local files, environment variables, credentials, or network access.

Do not include production secrets, certificates, private keys, tokens, internal hostnames, or full production HAProxy configs.

## Security Expectations

This extension treats HAProxy config files as untrusted input. Contributions must not add:

- `eval()` or `new Function()`.
- Raw HTML rendering of config content.
- Telemetry without explicit opt-in.
- Shell execution with user-controlled strings.
- File-system reads outside documents opened by the user.

Dependency changes should be minimal and must pass `npm audit --audit-level=high`.

Dependabot version updates are configured in `.github/dependabot.yml` for npm dependencies and GitHub Actions. Dependabot security updates still need to be enabled in the repository security settings if they are not already active.
