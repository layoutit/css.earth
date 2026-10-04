/** Short retirement ledger, curated from `git log --diff-filter=R --name-status` during plan 6.
 * Keep prefixes only for fully drained owners; add a prefix when its last live caller moves. */
export const RETIRED_PATHS = [
  'tools/',
  'integration/renderer-bake/', // 3b092f2039: tests moved to their producing/consuming owners.
  'packages/objects/src/baking/', // b5d83cac27: bake owns these algorithms.
  'packages/objects/src/geometry/', // b5d83cac27: now bake's surface-geometry.
] as const;
/** These relocated executable owners resolve the checkout from their module, independent of launch directory.
 * A CLI argument's cwd is legitimate elsewhere; it must not replace these owners' module-relative roots. */
export const MODULE_RELATIVE_ROOT_OWNERS = [
  '.github/scripts/ci/build-ci.mts',
  '.github/scripts/ci/ci-cache-key.mts',
  '.github/scripts/ci/check-ci.mts',
] as const;
