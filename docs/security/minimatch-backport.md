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
