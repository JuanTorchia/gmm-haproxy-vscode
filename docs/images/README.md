# Demo Images

This directory contains Marketplace and README visuals for the extension.

## Policy

Visual assets are part of the product surface. Keep them in the same pull request as any editor-visible change.

Update or regenerate demos when changing:

- syntax highlighting or TextMate scopes
- completion items, sorting, detail, documentation, or value suggestions
- diagnostics, warning/error text, related information, or quick fixes
- hover content, signatures, version metadata, or documentation links
- definition navigation, folding, symbols, formatting, snippets, or settings UI
- README feature descriptions that no longer match the captured behavior

If the visual output does not change, say that explicitly in the pull request.

## Regenerating GIFs

Install ImageMagick and run:

```bash
npm run demo:gifs
```

The script generates:

| Output | Source frames |
|---|---|
| `02-completion.gif` | `02-completion-ba.png`, `02-completion-balance.png`, `02-completion-http.png` |
| `03-validation.gif` | `03-validation-error.png`, `03-validation-warning.png`, `03-validation-warning-backend.png` |
| `04-hover.gif` | `04-hover-balance.png`, `04-hover-http-request.png`, `04-hover-httpchk.png`, `04-hover-stick-table.png`, `04-hover-timeout.png` |
| `09-undefined-backend.gif` | `09-undefined-backend.png` |

## Source Frames

Keep source frames committed. They make demo updates reviewable and let contributors regenerate GIFs without manual editing.

Do not edit generated GIFs by hand. Update the PNG source frames, run `npm run demo:gifs`, and commit both the source frame changes and regenerated GIFs.

## Demo Configs

Use `docs/demo-configs/09-undefined-backend.cfg` when refreshing the undefined-backend diagnostic source frame. It is intentionally small so the capture shows the cross-reference warning without unrelated diagnostics.

## Review Checklist

Before merging visual updates:

- Confirm `npm run demo:gifs` succeeds.
- Confirm the README references the intended generated GIF or screenshot.
- Keep generated GIFs small enough for Marketplace browsing. Existing GIFs are intentionally under 300 KB except full interaction demos.
- Avoid including production hostnames, internal IP ranges that reveal real infrastructure, certificates, tokens, or customer data in source frames.
