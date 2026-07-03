# HAProxy Config — VS Code Extension

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/gmm.gmm-haproxy-vscode?label=VS%20Code%20Marketplace&logo=visualstudiocode&logoColor=white&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=gmm.gmm-haproxy-vscode)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/gmm.gmm-haproxy-vscode?label=Installs&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=gmm.gmm-haproxy-vscode)
[![Rating](https://img.shields.io/visual-studio-marketplace/stars/gmm.gmm-haproxy-vscode?label=Rating&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=gmm.gmm-haproxy-vscode)
[![CI](https://github.com/JuanTorchia/gmm-haproxy-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanTorchia/gmm-haproxy-vscode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Version-aware HAProxy language support for VS Code.** Stop memorizing directive names, guessing valid options, and discovering config errors only when HAProxy refuses to start.

> Full language support for `.cfg` and `.conf` HAProxy files — with version-aware validation, intelligent autocompletion, and inline documentation right inside VS Code.

---

## Why DevOps and SRE teams use it

- **Catch mistakes before reloads** — unknown directives, wrong sections, undefined backends, deprecated options, and version mismatches show up while editing.
- **Edit against the HAProxy version you run** — validate configs for HAProxy 2.4, 2.6, 2.8, 3.0, or 3.1 per workspace.
- **Keep context in VS Code** — completions, hover docs, snippets, formatting, folding, symbol navigation, and quick fixes reduce trips to the manual.

If this extension helps you avoid HAProxy config mistakes, consider starring the repo so other operators can find it.

---

## Features

### Syntax Highlighting
Every token in your HAProxy config gets meaningful color — section headers, directives, ACL names, backend references, IP addresses, ports, and timeouts.

![Syntax highlighting](https://raw.githubusercontent.com/JuanTorchia/gmm-haproxy-vscode-assets/main/01-syntax-highlighting.png)

---

### Intelligent Autocompletion
Context-aware suggestions that know which directives are valid in each section. No more guessing whether `use_backend` belongs in a `backend` or a `frontend`.

- Filters by section type (`frontend`, `backend`, `global`, etc.)
- Respects `mode http` vs `mode tcp` — only shows relevant options
- Deprecated directives shown with strikethrough
- Every suggestion includes signature and documentation

![Autocompletion demo](docs/images/02-completion.gif)

---

### Version-Aware Validation
Select your HAProxy version and get real-time diagnostics tailored to it. Directives removed in 2.4? Flagged as errors. Options deprecated in 3.0? Flagged as warnings — with the exact migration path.

- **Errors** — unknown directives, wrong section, removed features, syntax issues
- **Warnings** — deprecated directives with upgrade hints
- **Cross-references** — `use_backend` pointing to an undefined backend

![Validation diagnostics demo](docs/images/03-validation.gif)

Focused demo config: [`docs/demo-configs/09-undefined-backend.cfg`](docs/demo-configs/09-undefined-backend.cfg)

![Undefined backend diagnostic screenshot](docs/images/09-undefined-backend.gif)

---

### Hover Documentation
Hover over any directive for instant reference: signature, description, valid sections, version availability, and a direct link to the HAProxy docs.

![Hover documentation demo](docs/images/04-hover.gif)

---

### Go-to-Definition
Press `F12` (or `Ctrl+Click`) on any backend name in a `use_backend` or `default_backend` directive to jump directly to its definition.

![Go-to-definition](https://raw.githubusercontent.com/JuanTorchia/gmm-haproxy-vscode-assets/main/05-definition.gif)

---

### Section Folding
Collapse and expand individual HAProxy sections to focus on what matters.

![Section folding](https://raw.githubusercontent.com/JuanTorchia/gmm-haproxy-vscode-assets/main/06-folding.png)

---

### Quick Fix — Deprecated Directives
Deprecated directives get a warning with a lightbulb quick fix. One click replaces the directive with the modern equivalent.

![Quick fix for deprecated directive](https://raw.githubusercontent.com/JuanTorchia/gmm-haproxy-vscode-assets/main/08-code-action.png)

---

### Snippets
Start typing a section name and get a fully-formed boilerplate with tabstops. No more blank-page paralysis.

| Prefix | Inserts |
|---|---|
| `global` | Global block with logging, threads, stats socket |
| `defaults` | Defaults with all common timeouts |
| `frontend` | HTTP frontend |
| `frontend-ssl` | HTTPS frontend with SSL termination |
| `backend` | HTTP backend with health check |
| `backend-ssl` | HTTPS backend |
| `listen` | HAProxy stats listener |
| `acl` | ACL definition |
| `use_backend` | Conditional backend routing |
| `server` | Server line with health check params |
| `httpchk` | HTTP health check option |

---

### Document Formatting
One keypress (`Shift+Alt+F`) normalizes your entire config: section headers at column 0, directives indented consistently, blank lines cleaned up — without touching your comments or string values.

---

## Multi-Version HAProxy Support

Validate your config against the exact HAProxy version running in production. Switch versions per workspace — no global settings that affect other projects.

| Version | Type | Status |
|---|---|---|
| **3.1** | Stable | ✅ Latest — default |
| **3.0** | Stable | ✅ Supported |
| **2.8** | LTS | ✅ Recommended LTS |
| **2.6** | LTS | ✅ Supported |
| **2.4** | LTS | ✅ Supported (EOL 2026) |

The status bar shows your active version at all times. Click it to switch instantly.

---

## Installation

**From VS Code:**
1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Search for `HAProxy Config`
3. Click **Install**

**From the command line:**
```bash
code --install-extension gmm.gmm-haproxy-vscode
```

The extension activates automatically when you open any `.cfg` or `.conf` file named or detected as HAProxy config.

---

## Configuration

All settings are available under `File → Preferences → Settings → HAProxy`.

![Settings panel](https://raw.githubusercontent.com/JuanTorchia/gmm-haproxy-vscode-assets/main/settings.png)

| Setting | Default | Description |
|---|---|---|
| `haproxy.version` | `3.1` | HAProxy version to validate against |
| `haproxy.validate.enable` | `true` | Enable/disable live validation |
| `haproxy.completion.enable` | `true` | Enable/disable autocompletion |
| `haproxy.trace.server` | `off` | LSP trace level (`off` / `messages` / `verbose`) |

**Per-workspace version** — open `.vscode/settings.json` and add:
```json
{
  "haproxy.version": "2.8"
}
```

This overrides the global setting for that workspace only, so different projects can validate against different HAProxy versions simultaneously.

---

## Commands

| Command | Description |
|---|---|
| `HAProxy: Select Version` | Change validation version via QuickPick |
| `HAProxy: Restart Language Server` | Restart if the server gets into a bad state |

---

## Why this extension?

HAProxy is one of the most widely deployed load balancers in the world. But editing its config has always been a text-editor experience — no hints, no validation, no documentation. You either memorize the manual or keep a browser tab open.

This extension brings the config editing experience up to the same level as editing code:

- **Catch errors before deployment** — not when HAProxy refuses to reload
- **Stay on the right version** — avoid deploying directives that don't exist in your production binary
- **Onboard faster** — new team members get inline docs without needing to read the full manual
- **Move faster** — snippets and completion eliminate the boilerplate

---

## Requirements

- VS Code `1.110.0` or newer
- Node.js is **not** required on the target machine — the language server is bundled

---

## Contributing

Issues and pull requests are welcome at [github.com/JuanTorchia/gmm-haproxy-vscode](https://github.com/JuanTorchia/gmm-haproxy-vscode).

The most useful contributions are small and specific: missing directive metadata, sanitized real-world fixtures, version-specific validation tests, snippet improvements, and documentation that helps operators trust the extension.

Useful starting points:

- [Roadmap](ROADMAP.md) — what is planned for v1.0 and later
- [Discussions](https://github.com/JuanTorchia/gmm-haproxy-vscode/discussions) — share HAProxy editing pain points and help shape future milestones
- [v0.3.0 milestone](https://github.com/JuanTorchia/gmm-haproxy-vscode/milestone/1) — current candidate work
- [Good first issues](GOOD_FIRST_ISSUES.md) — small, useful starter tasks
- [Contributing guide](CONTRIBUTING.md) — setup, tests, project layout, PR expectations
- [Support](SUPPORT.md) — where to report bugs, request features, or ask questions
- [Security policy](SECURITY.md) — how to report vulnerabilities privately

**To run locally:**
```bash
git clone https://github.com/JuanTorchia/gmm-haproxy-vscode
cd gmm-haproxy-vscode
npm ci
npm ci --legacy-peer-deps --prefix client
npm ci --legacy-peer-deps --prefix server
npm run compile
```

Then press `F5` in VS Code to open an Extension Development Host with the extension loaded.

**Before submitting a PR:**
- `npm run lint` must pass
- `npm run compile` must pass
- `npm run test:unit` must pass for most changes
- `npm test` must pass before larger runtime or integration changes

If you use the Marketplace extension and notice missing HAProxy behavior, open an issue with a sanitized config snippet. Those reports directly improve completion, hover docs, and validation accuracy.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE) © Juan Torchia
