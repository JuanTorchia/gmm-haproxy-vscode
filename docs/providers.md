# Language Providers

Each provider is an isolated class that receives an AST and returns LSP-typed results. No provider imports from another provider.

---

## ValidationProvider

**File:** `server/src/validation/validator.ts`

Validates a `HaproxyDocument` against a specific HAProxy version and returns an array of LSP `Diagnostic` objects.

### Constructor

```typescript
new ValidationProvider(registry: VersionRegistry, version: string)
```

### Method: `validate(doc: HaproxyDocument): Diagnostic[]`

Returns at most `MAX_DIAGNOSTICS` (100) diagnostics to prevent flooding slow configs.

**Validation pipeline** (in order):

1. **Parse errors** — emitted first as `DiagnosticSeverity.Error`. These come from the parser itself (e.g. directive outside any section).

2. **Unknown directive** (`Error`) — the directive name is not in the registry for the current version. If the name exists in a higher version, the message suggests "available since X".

3. **Removed directive** (`Error`) — the directive existed in a previous version but has `removedInVersion` ≤ current version. The message includes a migration hint where available (e.g. `reqrep` → `http-request replace-value`).

4. **Deprecated directive** (`Warning`) — the directive has `deprecatedSinceVersion` ≤ current version. Still works in HAProxy but generates a warning in the editor.

5. **Wrong section** (`Error`) — the directive's `sections` array does not include the current section type. Example: `use_backend` in a `backend` section.

6. **Mode mismatch** (`Error`) — directive has `httpOnly: true` but the section is in `mode tcp`, or `tcpOnly: true` but section is in `mode http`.

### Diagnostic Messages

All messages follow the pattern: *what is wrong* + *how to fix it*.

| Check | Severity | Example message |
|-------|----------|-----------------|
| Unknown directive | Error | `Unknown directive 'reqtimeout'. It may be available since HAProxy 2.4.` |
| Removed directive | Error | `'reqrep' was removed in HAProxy 2.4. Use 'http-request replace-value' instead.` |
| Deprecated | Warning | `'redispatch' is deprecated since HAProxy 2.4. Use 'option redispatch' instead.` |
| Wrong section | Error | `'use_backend' is not valid in a 'backend' section. Valid sections: defaults, frontend, listen.` |
| HTTP-only in TCP | Error | `'option httplog' requires HTTP mode but this section is in TCP mode.` |
| TCP-only in HTTP | Error | `'tcp-request connection' requires TCP mode but this section is in HTTP mode.` |

---

## CompletionProvider

**File:** `server/src/completion/completionProvider.ts`

Provides context-aware completion items filtered by section type and current mode.

### Constructor

```typescript
new CompletionProvider(registry: VersionRegistry, version: string)
```

### Method: `provideCompletions(doc: HaproxyDocument, position: Position): CompletionItem[]`

**Algorithm:**

1. Find the section the cursor is on (`findSectionAtLine`). The active section is the last section whose `headerRange.startLine` is ≤ the cursor line.
2. If **no section** → return section keyword completions (`global`, `defaults`, `frontend`, `backend`, etc.).
3. If **inside a section** → return all directives valid for that section type, filtered by mode.

**Filtering:**
- Only directives whose `sections` includes the current `SectionType` are shown.
- If the section has a known mode, `httpOnly` directives are hidden in TCP mode and `tcpOnly` directives are hidden in HTTP mode.

**Sorting:** Non-deprecated first, then alphabetical within each group.

**Deprecated items** receive `tags: [CompletionItemTag.Deprecated]`, which causes VSCode to render them with a strikethrough.

### CompletionItem shape

```
label:         directive name (e.g. "option")
kind:          CompletionItemKind.Keyword
detail:        signature (e.g. "<name> [param ...]")
documentation: Markdown — description + since version + docs link
tags:          [Deprecated] if applicable
```

---

## HoverProvider

**File:** `server/src/hover/hoverProvider.ts`

Provides inline documentation when the user hovers over a directive keyword.

### Constructor

```typescript
new HoverProvider(registry: VersionRegistry, version: string)
```

### Method: `provideHover(doc: HaproxyDocument, position: Position): Hover | null`

Returns `null` if:
- The cursor is not over any directive (e.g. hovering on a blank line or section header).
- The directive is not in the registry (unknown directive).
- The cursor is over an argument, not the keyword itself.

**Hit detection:** Iterates all directives in all sections. For each directive:
1. Checks if the cursor line is within the directive's range.
2. Then checks if the cursor column is within the **keyword token** range specifically.

This ensures hover only triggers on the directive name, not its arguments.

### Hover content structure

```markdown
**`bind`** `<addr>[:<portrange>] [param*]`
---
Define a listener on the given address and port.

**Valid in:** frontend, listen
**Since:** HAProxy 2.4  |  ~~**Deprecated in:** 2.8~~
**Requires:** HTTP mode
**Current mode:** http

[📖 HAProxy Docs](https://docs.haproxy.org/3.1/configuration.html#4.2-bind)
```

| Section | Content |
|---------|---------|
| Title | `**\`name\`**` + signature in backticks |
| Separator | `---` horizontal rule |
| Description | One-line plain text |
| Sections | Comma-separated list of valid section types |
| Version | Since, deprecated (strikethrough), removed |
| Mode | Only shown if `httpOnly` or `tcpOnly` |
| Context | Current section mode (only if resolved) |
| Docs | Clickable link (only if `docsUrl` is set) |

---

## FormattingProvider

**File:** `server/src/formatting/formatter.ts`

Formats a HAProxy config document by normalizing indentation. Works on raw text — does not use the AST.

### Method: `format(doc: TextDocument, options: FormattingOptions): TextEdit[]`

Returns an empty array if the document is already correctly formatted (no-op case).

**Formatting rules:**

| Rule | Behavior |
|------|----------|
| Section headers | Always at column 0 (no leading whitespace) |
| Directives | Indented with one indent level (4 spaces by default, or `tabSize` from options) |
| Comments | Indented same as directives if inside a section; at column 0 if before any section |
| Blank lines | Maximum 1 consecutive blank line anywhere in the file |
| Trailing blanks | All trailing blank lines removed |
| Line endings | Normalized to `\n` (LF) |

**Options support:**
- `insertSpaces: true` → use `' '.repeat(tabSize)` as indent
- `insertSpaces: false` → use `\t` as indent
- `tabSize` → controls space count when `insertSpaces` is true

**Implementation note:** The formatter does a single linear pass over lines. It tracks:
- `inSection: boolean` — whether we've seen at least one section header
- `consecutiveBlanks: number` — to enforce the max-1 blank line rule

The entire document is replaced with a single `TextEdit.replace` covering the full range. If the result is identical to the input, an empty array is returned to avoid unnecessary `didChange` events.

---

## Symbol Resolution (shared)

**File:** `server/src/shared/symbolResolver.ts`

Definition, references, document highlight, and rename all answer the same two questions, so they share one resolver instead of importing from each other:

- `resolveSymbolAtPosition(doc, position)` returns the named symbol under the cursor (`{ name, kind, scopeHeaderLine? }`) or `null`.
- `collectOccurrences(doc, symbol)` returns every `{ range, isDefinition }` for that symbol in the document.

Name matching is case-insensitive and token-based, never substring text search.

| Kind | Definition | References | Scope |
|------|------------|------------|-------|
| `backend` | `backend <name>`, `listen <name>` | `use_backend <name>`, `default_backend <name>` | File |
| `defaults` | `defaults <name>` | `from <name>` in section headers | File |
| `acl` | `acl <name> …` | names in `if` / `unless` conditions, including `!<name>` | Owning section |
| `server` | `server <name>`, `server-template <name>` | `use-server <name>` | Owning section |
| `cache` | `cache <name>` | `http-request cache-use <name>`, `http-response cache-store <name>` | File |
| `userlist` | `userlist <name>` | `http_auth(<name>)`, `http_auth_group(<name>)` | File |
| `resolvers` | `resolvers <name>` | `server … resolvers <name>` | File |
| `peers` | `peers <name>` | `stick-table … peers <name>` | File |

Dynamic backend names such as `use_backend %[req.hdr(host)]` are not resolved. For negated ACL references the returned range excludes the `!`.

---

## DefinitionProvider

**File:** `server/src/definition/definitionProvider.ts`

### Method: `provideDefinition(doc: HaproxyDocument, position: Position): Location | null`

Returns the location of the definition occurrence for the symbol under the cursor (`F12`, `Ctrl+Click`). On the definition itself it returns its own location, which lets VS Code fall back to its references peek.

---

## ReferencesProvider

**File:** `server/src/references/referencesProvider.ts`

### Method: `provideReferences(doc: HaproxyDocument, position: Position, includeDeclaration: boolean): Location[]`

Backs **Find All References** (`Shift+F12`, `Shift+Alt+F12`). Returns every occurrence of the symbol under the cursor; the definition is dropped when `includeDeclaration` is `false`.

---

## DocumentHighlightProvider

**File:** `server/src/highlights/documentHighlightProvider.ts`

### Method: `provideHighlights(doc: HaproxyDocument, position: Position): DocumentHighlight[]`

Highlights all occurrences of the symbol under the cursor. The definition is returned with `DocumentHighlightKind.Write` and references with `DocumentHighlightKind.Read`, so themes can tell them apart.

---

## RenameProvider

**File:** `server/src/rename/renameProvider.ts`

### Method: `prepareRename(doc: HaproxyDocument, position: Position): { range: Range; placeholder: string } | null`

Runs before the rename box opens (`F2`). Returns the range of the name under the cursor and the current name as placeholder, or `null` when the cursor is not on a renameable symbol, so VS Code shows "cannot rename" instead of opening the box.

### Method: `provideRename(doc: HaproxyDocument, position: Position, newName: string): WorkspaceEdit | null`

Returns one `WorkspaceEdit` that replaces every occurrence returned by `collectOccurrences` with `newName`. The edit is applied atomically and stays within the current document. For `!acl` references only the name is replaced, so the negation is preserved.

---

## SymbolsProvider

**File:** `server/src/symbols/symbolsProvider.ts`

### Method: `provideSymbols(doc: HaproxyDocument): DocumentSymbol[]`

Backs the Outline view, breadcrumbs, and **Go to Symbol in Editor** (`Ctrl+Shift+O`). Returns one symbol per section, labelled `<type> <name>` (or just `<type>` for unnamed sections such as `global`), with the section's full line range.

| Section type | `SymbolKind` |
|--------------|--------------|
| `global` | `Namespace` |
| `frontend` | `Interface` |
| `backend` | `Class` |
| `listen` | `Function` |
| `userlist` | `Object` |
| Other sections (`defaults`, `peers`, `resolvers`, `cache`, …) | `Module` |

Child symbols surface the structural directives of each section:

| Directive | Child label | `SymbolKind` | Detail |
|-----------|-------------|--------------|--------|
| `bind` | `bind <address>` | `Event` | — |
| `server`, `default-server` | `server <name>` | `Field` | server address |
| `acl` | `acl <name>` | `Constant` | — |
