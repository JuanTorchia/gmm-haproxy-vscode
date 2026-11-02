# Minimatch preprocessing backport

The locked minimatch 10.2.6 is patched during root/client `npm ci` and checked
again before packaging. `scripts/patch-minimatch.cjs` verifies SHA-256 of both
original module formats, applies the three upstream changes from
[77a0f5c](https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8),
and accepts only the exact original or fully patched source. Drift or partial
patches fail; repeat execution is idempotent. Do not use `--ignore-scripts` for
validation. No external code is downloaded by the patch script.

Minimatch 11 removes `makeRe()`, which languageclient 10.1.2 still calls in
`fileOperations` and `utils/globPattern`. A blanket major override breaks those
paths. The backport caps level-2 pattern splitting at `braceExpandMax` and skips
quadratic deduplication above 1000 patterns while preserving the 10.x API.
The reviewed LSP paths currently use level 1; exploitation through them has not
been demonstrated. Tests exercise the actual LSP utility, dot/case behavior and
the upstream regression in a killable subprocess with bounded memory/output.

npm audit/Dependabot still flag version 10.2.6; those tools do not recognize
source backports. Keep that residual visible, without dismissing or suppressing
the advisory. Replace this backport with an upstream compatible fix when one
exists and all consumers pass CI. Root and client use independent locks.
Reverting restores the vulnerable source. Merging alone does not publish an
update to existing users.

## Tooling follow-up for 0.7.2

Glob 14.0.3 gets its own minimatch 11.0.4. The `<11` override only targets
legacy consumers; 11.0.4 is recognized as patched and is not modified.
qs 6.17.1 and serialize-javascript 7.1.4 remove their advisories. Raw root
audit now reports 28 affected packages (3 low/25 moderate), propagated from
two advisory families: the backported minimatch and unpatched deepmerge.
No high/critical findings or new advisory suppression were introduced.

Deepmerge 4.3.1 is a development dependency of Jest configuration loading.
This repository's Jest configuration is committed, static maintainer-controlled
code, not parsed HAProxy content or runtime user input. The prototype-pollution
advisory GHSA-gcqx-w48m-w2h4 has no patched release. The residual stays visible;
do not downgrade Jest or label the library fixed. Untrusted PR configuration
already runs as code in the read-only, unprivileged CI validation environment;
release credentials are only used after validation in the protected job.
Revisit the dependency when upstream provides a compatible fix.
