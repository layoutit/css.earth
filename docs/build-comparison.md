# Built-site comparison

The comparator checks the complete final Astro output, with production mode,
`ASSET_ORIGIN=https://earth-assets.lowpoly.cc`, strict prepared-asset availability,
a pinned source revision and version, UTC and the C locale. It adds hidden client/worker source maps
and read-only module metadata. It does not run deployment, share-image generation,
object assembly or server-function bundling.

## Run locally

Use isolated base and head checkouts. Preparation is derived from the checkout's
`build:deploy` script. Its restoration step installs prepared files plus the exact
public feature catalogues, fallback dataset thumbnails and startup billboard WebPs
its preparation and prerender readers need.
Those public inputs are not the full scene bank. The prepared cache contains
the prepared bank; necessary public inputs restore separately.
The final production-shaped Astro stage needs only the selected local scene files,
including startup photographs that it embeds directly. It reads
tracked inventories, restored object prepared packages, built workspace packages,
generated shell/catalogue inputs and the other public files.

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
export TZ=UTC LC_ALL=C NODE_OPTIONS=--max-old-space-size=6144 CSSEARTH_SKIP_DECLARATIONS=1
export ASSET_ORIGIN=https://earth-assets.lowpoly.cc CSSEARTH_ALLOW_MISSING_ASSETS=0
BASE_CHECKOUT=/absolute/path/to/base
HEAD_CHECKOUT=/absolute/path/to/head
COMPARISON_OUT="$HEAD_CHECKOUT/output/build-comparison"
# The trusted tools are from the merge-base. Bootstrap/tool changes require explicit review.
COMPARISON_TOOLS="$BASE_CHECKOUT/.github/scripts/build-compare"
for COMPARISON_CHECKOUT in "$BASE_CHECKOUT" "$HEAD_CHECKOUT"; do
  if [ "$COMPARISON_CHECKOUT" != "$BASE_CHECKOUT" ]; then
    cp -R "$COMPARISON_TOOLS/." "$COMPARISON_CHECKOUT/.github/scripts/build-compare/"
  fi
  (
    cd "$COMPARISON_CHECKOUT"
    pnpm install --frozen-lockfile --ignore-scripts
    node --input-type=module -e '
      import {readFileSync} from "node:fs";
      import {execFileSync} from "node:child_process";
      import {comparisonPreparation} from "./.github/scripts/build-compare/ci.mts";
      const recipe=comparisonPreparation(JSON.parse(readFileSync("package.json","utf8")));
      execFileSync("bash",["--noprofile","--norc","-e","-o","pipefail","-c",recipe],{stdio:"inherit"});
    '
  )
done
node "$COMPARISON_TOOLS/build.mts" --checkout "$BASE_CHECKOUT" --out "$COMPARISON_OUT/base"
node "$COMPARISON_TOOLS/build.mts" --checkout "$HEAD_CHECKOUT" --out "$COMPARISON_OUT/head" --toolchain "$COMPARISON_OUT/base/toolchain.json"
node "$COMPARISON_TOOLS/compare.mts" --base "$COMPARISON_OUT/base" --head "$COMPARISON_OUT/head" --mode report --json "$COMPARISON_OUT/report.json"
```

For semantic comparisons, provide `--sources sources.json`, containing source-diff
`paths`, declared changed `objects`, `outputs` and `layout`. Output globs support
`*`, `**` and `?` on relative emitted paths. CI derives the paths with
`git diff --name-status -M <merge-base>..HEAD`; arbitrary output differences never
seed their own permission. Pass `--moves moves.json` for source renames.

## Equalities and permissions

- **Semantic equality:** renamed module sets, rendered code and ordered static
  and dynamic imports match, separately for each build environment.
- **Layout equality:** chunk membership and source module order match; HTML,
  JavaScript, CSS, assets, data, other files and every object inventory are
  compared independently. Route attribution remains visible in the report.
- **`pure-move`:** every dimension must match, including formatting refactors.
- **`semantic`:** seeds are source-diff paths intersected with metadata modules.
  Source diffs under renderer, engine, core and objects seed that package
  dist bank best effort because bundled outputs lack per-source maps. This is
  package granularity; individual bundled producers and other packages are not mapped. Direct importers are listed separately; changed immediate
  importers can explain inlined constants at chunk granularity.
  The computed closure is an upper bound, never an output permission. Every
  HTML/CSS/data/asset difference also needs a declared `outputs` glob and reason.
  A constant changing only JavaScript declares `outputs: []`. A shared-layout
  seed opens all 9,890 pages; declared outputs bound them. Output declarations
  that select files outside the closure fail. HTML changes are grouped by
  identical normalized diff hunk for review.
  `layout: "changes"` separately permits chunk movement only with an unchanged
  module set and identical code and ordered imports in every non-seed module.
  Without it, incidental chunk restructuring fails. Inventory changes additionally
  require the affected object in `objects`; downstream outputs still need globs.
- **`report`:** differences are informational. Dependency/toolchain mismatch is
  recorded as a skipped comparison with a notice; other tool failures still fail.

Exit codes: **0** allowed result; **1** disallowed differences; **2** invalid
input or comparator error. Failed build stages fail the workflow independently
of artifact upload; missing artifacts warn and cannot replace the stage verdict.

## Normalization and evidence

Source links use the fixed `COMMIT_REF` recorded in `toolchain.json`; the git shim
pins the version count independently. Absolute checkout roots become `<root>`. Vite asset placeholders resolve through
their recorded emitted-file binding. Boundary-checked move renaming applies to
module code and emitted text, including source-path HTML attributes. Hashed file
references become canonical chunk/asset identities; a separately compared
reference graph detects references to the wrong chunk. No general whitespace or
code formatting normalization applies.

Chunk identity uses the environment and sorted renamed module set; source order
is retained and checked separately. Each module has an md5 code record and each
emitted chunk has an md5 record captured after all Vite/Astro rewrites.
Optional literal module-code containment is recorded as a diagnostic when
an observed chunk contains it; it does not participate in the verdict: transformed module code often differs
from captured chunk text, including SSR chunks, so those records omit the witness.
Independent module and output digests do not establish that a module's recorded
code appears in its emitted chunk. This optional diagnostic does not grant permissions. Attribution is at chunk
granularity: it cannot identify which producer inside a changed chunk changed.
These are consistency checks, not protection against jointly forged evidence.
Only maps explicitly added by the comparison plugin are excluded. Other maps
remain comparison inputs. Lockfiles are recorded and compared as bytes.

## Move helper

`apply-moves.mts --checkout <checkout> <moves.json> --dry-run` prints the move plan
without changing files or the index. Omit `--dry-run` to apply it. The helper scans
every tracked text file and rewrites supported relative imports, literal URLs,
exact glob operands, CSS imports/URLs, local Markdown links and exact moved
source paths in maintained configuration. Commit-pinned remote links stay historical.

Other moved-path, basename and folder operands are reported as `UNRESOLVED` with
file, line and expression. Computed references refuse where rewriting could be
wrong; plain string operands require manual review. Unrelated opaque warnings
are summarized by count. Review every unresolved entry and typecheck the moved
checkout before accepting a move.

## CI and resource budget

[Site safety net](../.github/workflows/site-safety-net.yml) owns its build trigger:
renames under `site/**`, `src/**`, `packages/*/src/**` and `astro.config.mts`
(excluding test/spec modules), fresh declarations, refactor markers and explicit
labels/dispatch. It does not use the shared CI classifier to select this lane. Ordinary application PRs run
with `compare-build` or manual dispatch. Fresh declarations and application
renames select the build automatically. A declaration is honored only when this
PR adds or changes it against the merge-base; a stale declaration means report mode.

```json
{
  "mode": "semantic",
  "moves": {},
  "outputs": [{"glob": "earth/index.html", "reason": "Expected Earth content update"}],
  "layout": "none"
}
```

The always-running **Refactor declaration gate** requires a fresh declaration
for application renames or the `refactor` label.
It uses merge-base tooling, needs no dependencies or builds, and remains a real
check when the longer build job is skipped. Selection tooling also comes from
the merge-base. Bootstrap requires the owner to first install this workflow and
tool folder on main; their absence fails clearly.

Owner repository settings:

1. Require **Refactor declaration gate** in branch protection; the conditional
   build job is not the enforcement check.
2. Add code-owner entries for `.github/workflows/site-safety-net.yml`,
   `.github/scripts/build-compare/**` and `.github/site-refactor.json` in the
   owner's existing CODEOWNERS; enable **Require review from Code Owners**.
   This change does not add a CODEOWNERS file.
3. Create `compare-build`, `tool-change` and `refactor` labels. Restrict label
   management to trusted maintainers. `tool-change` or `"tools":"head"` permits
   head comparison tooling and emits a visible trust-override warning.
4. Save asset caches from main only. PR jobs restore only. An organization
   ruleset requiring the workflow from main adds protection against hostile
   workflow edits that ordinary required-check settings cannot provide.

The gate and the build job take their tools from the merge base. Only the pull request that
introduces these tools has no merge-base copy: it runs its own tools and prints a visible
bootstrap warning. Once the tools are on the main branch that path is never taken again.

A rename/specifier-only diff forces pure-move. Report mode skips lockfile or
installed-toolchain mismatches with a notice. Toolchain records contain lockfile
byte length; separate lockfile files are compared byte for byte.

The prepared cache matches universe's `prepared-files-v2-` key and
`src/objects/*/prepared` paths. Nightly's existing `inventory-v1-` cache includes
the full public scene bank: it is a different payload and exceeds this lane's
prepared-only budget. This change does not unify those two cache namespaces.
The key is computed immediately after the merge-base checkout, before any
preparation can rewrite inventories. PRs never save it. Base/head prepared sharing
uses copies so head preparation cannot mutate the cached bank. The two checkouts share Git history via a
worktree rather than a second full-history clone. The base stays at the workspace
root so its cache path matches universe exactly. pnpm is installed
with an explicit package file and store cache, avoiding a root-package assumption.
Runs share a PR concurrency group. Cancellation is true only for synchronize
events; labeled/unlabeled events cannot cancel a running build. A new push may
cancel the previous run, regardless of which event started it.
Both CI jobs use Node 24. Hosted Node 24, cold restoration and upload remain
unmeasured offline.

This lane owns its trigger independently of the shared CI classifier. Default
`pnpm check:ci --list` passes on both origin/main and this branch. Explicitly
selecting the existing astroquery lane exposes its `actions/setup-python` runner
support gap; that is separate from this lane. Local listing does not prove GitHub execution.

Measured locally on 2026-10-05 at application commit
`6e270e54e4eaf267e7ecdb51738536f1b6d3b265`, with
Node 22.23.2. Disk figures are allocated `du -sk` sizes; preparation subset bytes
come from the actual descriptor URLs and inventory sizes.

| Resource or stage | Local measurement | Two-side budget |
| --- | ---: | ---: |
| Restored prepared bank | 3.62 GiB | 7.24 GiB with isolated prepared copies |
| Production-shaped dist, including added maps | 4.17 GiB | 8.34 GiB |
| Comparison metadata | 0.12 GiB | 0.24 GiB |
| Root dependencies | 0.39 GiB | 0.78 GiB, plus workspace dependencies |
| Checkout histories and working files | about 2.2 GiB per full clone | Worktree shares history; allow 2.2 GiB |
| pnpm store | about 1 GiB allowance | 1 GiB |
| Public selected inputs, uncached | 174.9 MB / 5,832 files | 349.8 MB |
| Dist object transports (included above) | 2.47 GiB | 4.95 GiB |
| Comparison base / injected head build | 438.0 / 366.6 s | 13.4 min measured |
| Plain production build with full scenes | 353.7 s | Parity control, not a CI stage |
| Full-scene production parity | 36.7 s | Zero differences across 46,419 files |

The two copied prepared banks, outputs, metadata, dependencies and selected
public inputs need about **17 GiB**. Allow about **3 GiB** for checkout history,
working files and the pnpm store: **20 GiB total**, plus any extra generated files.
Copying the prepared bank instead of sharing inodes costs **3.62 GiB** and
prevents head preparation from altering base inputs.
The cache payload is one prepared bank (3.62 GiB), not both outputs or scene banks;
it shares the repository-wide 10 GB quota with other workflows.

Local final builds plus a comparison cost about **14–17 minutes**.
Budget **20–40 minutes** on a slower hosted runner before preparation, installation
and upload; this is an estimate, not a GitHub measurement. The lane's 90-minute
ceiling covers those unmeasured stages. Ordinary feature PRs opt in so this cost
does not become the default merge path.
