# Community Growth Design

## Goal

Make the repository easier to trust, evaluate, and contribute to so visitors are more likely to star it, open useful issues, and submit small pull requests.

## Scope

This design covers three public-facing improvements:

1. Repository trust: security reporting, support guidance, safer ignore rules, and consistent project URLs.
2. Contributor onboarding: issue templates, pull request template, clearer contribution paths, and starter tasks.
3. Visibility: a short roadmap and README links that show the project is active and has clear next steps.

This does not add HAProxy language features or change runtime behavior.

## Design

### Trust Surface

Add `SECURITY.md` with a private vulnerability reporting path, supported version policy, and explicit guidance not to include real HAProxy configs, secrets, or certificates in public reports. Add `SUPPORT.md` to route usage questions, bugs, and security reports to the right channel. Strengthen `.gitignore` with common secret and service account patterns, including the misspelled local file name currently present in the working tree.

### Contributor Funnel

Add GitHub issue forms for bugs, feature requests, and directive data contributions. Each form asks for the minimum information maintainers need: extension version, VS Code version, HAProxy version setting, config snippet, expected behavior, and actual behavior. Add a pull request template that asks contributors to describe impact, testing, and checklist items without creating excessive process.

Improve `CONTRIBUTING.md` so a first-time contributor can pick a small task, install dependencies with reproducible commands, run focused checks, and understand where common changes live.

### Visibility

Add `ROADMAP.md` with current status, v1.0 focus, contribution-ready work, and later ideas. Add `GOOD_FIRST_ISSUES.md` with concrete starter tasks that do not require deep LSP knowledge. Update `README.md` to link these files near the contributing section and show the fastest path for new contributors.

## Validation

Because this is documentation and repository metadata only, validation is file review plus repository hygiene checks:

- Confirm all new Markdown and YAML files are present.
- Confirm URLs consistently target `JuanTorchia/gmm-haproxy-vscode`.
- Confirm `.gitignore` covers local secret patterns without deleting user files.
- Run `npm run lint` and `npm run compile` if dependency state allows it.
