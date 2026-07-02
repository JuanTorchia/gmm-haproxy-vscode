# Community Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the repository's public trust, contribution funnel, and visibility without changing extension runtime behavior.

**Architecture:** This is a repository metadata and documentation change. New files live at the repository root or under `.github/`, while existing README and contributing docs get targeted links and corrected repository references.

**Tech Stack:** Markdown, GitHub issue forms, GitHub Actions YAML, npm scripts.

## Global Constraints

- Communication with users remains Spanish; repository docs remain English.
- Do not touch HAProxy language server runtime logic.
- Do not stage or include local secret files such as `serviceaccout.json`.
- Prefer exact repository URL `https://github.com/JuanTorchia/gmm-haproxy-vscode`.
- Keep docs concise and contribution-oriented.

---

### Task 1: Repository Trust Files

**Files:**
- Create: `SECURITY.md`
- Create: `SUPPORT.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Existing security and supply-chain rules in `AGENTS.md`.
- Produces: Public guidance for vulnerability reports and safer local file handling.

- [ ] **Step 1: Add security reporting guidance**

Create `SECURITY.md` with supported versions, private reporting instructions, disclosure expectations, and guidance not to post secrets or full production configs publicly.

- [ ] **Step 2: Add support routing**

Create `SUPPORT.md` to route bugs, feature requests, questions, and security reports.

- [ ] **Step 3: Harden ignore rules**

Update `.gitignore` with `.env*`, key/certificate files, common cloud credential files, and the local misspelled `serviceaccout.json` pattern.

### Task 2: Contributor Funnel

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/directive_data.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: Existing package scripts and project layout.
- Produces: Structured contribution path for issues and PRs.

- [ ] **Step 1: Add GitHub issue forms**

Create issue templates that gather version, reproduction, HAProxy snippets, and expected vs actual behavior.

- [ ] **Step 2: Add PR template**

Create a pull request template with summary, validation, and risk checklist.

- [ ] **Step 3: Rewrite contribution quickstart**

Update `CONTRIBUTING.md` with exact clone URL, dependency install commands, focused test commands, and starter contribution categories.

### Task 3: Visibility and Roadmap

**Files:**
- Create: `ROADMAP.md`
- Create: `GOOD_FIRST_ISSUES.md`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Existing README feature positioning and CI workflow.
- Produces: Public roadmap, starter-task inventory, and stronger CI signal.

- [ ] **Step 1: Add roadmap**

Create `ROADMAP.md` with current status, v1.0 priorities, contribution-ready work, and later ideas.

- [ ] **Step 2: Add starter task guide**

Create `GOOD_FIRST_ISSUES.md` with specific low-risk tasks and required validation commands.

- [ ] **Step 3: Update README links**

Add links to roadmap, starter tasks, contributing, support, and security near the contribution section.

- [ ] **Step 4: Improve CI confidence**

Change CI to run on Ubuntu, Windows, and macOS using a matrix, while keeping the existing lint/type-check/audit/unit/build/package checks.

### Task 4: Verification

**Files:**
- Review all modified files.

**Interfaces:**
- Consumes: Repository scripts.
- Produces: Evidence for final status.

- [ ] **Step 1: Review changed files**

Run `git diff --check` and inspect `git diff --stat`.

- [ ] **Step 2: Run available automated checks**

Run `npm run lint` and `npm run compile`. If dependency or environment state blocks either command, record the exact blocker.
