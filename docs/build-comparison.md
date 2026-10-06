# Built-site comparison

**Where it runs.** The comparison is local work. Run it on your machine before you open a refactor PR (`node .github/scripts/build-compare/ci.mts --head <worktree> --base <worktree>`, plus the server answers and the performance guard), and paste its summary into the PR body. Pull requests run only the refactor declaration gate, which takes seconds and builds nothing. The `Site safety net` workflow can still run the full comparison by hand (`workflow_dispatch`), but nothing triggers it automatically.

The comparator checks the complete final Astro output, with production mode,
`ASSET_ORIGIN=https://earth-assets.lowpoly.cc`, strict prepared-asset availability,
a pinned source revision and version, UTC and the C locale. It adds hidden client/worker source maps
and read-only module metadata. It does not run deployment, share-image generation,
object assembly during comparison. After comparison, the safety-net job reuses the
same two outputs for [server answers](server-answers.md): it bundles the
Cloudflare Worker, records preview and Cloudflare, checks each recording and
compares each target. It never builds the site again.

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
  Server answers must match exactly too.
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
  A module that exists in one build only and whose every importer, read from both
  graphs, is in the closure is an orphaned dependency of the change (it left the
  bundle because its only importers did): it joins the closure. An importer outside
  the closure keeps it an independent difference.
  `layout: "changes"` separately permits chunk movement only when every module
  difference is a seed or an orphan (modules may therefore be added or removed with
  their chunks' identities), every import-list difference belongs to a seed, a direct
  importer or an orphan, and no other module changes its code.
  Without it, incidental chunk restructuring fails. Inventory changes additionally
  require the affected object in `objects`; downstream outputs still need globs.
  These permissions apply only to built-output comparison. Server status, headers,
  bodies, packaged file reads and deployment facts must always match exactly.
  Neither output declarations nor layout permissions allow server differences.
- **`report`:** differences are informational. Dependency/toolchain mismatch is
  recorded as a skipped comparison with a notice; other L3 tool failures still fail.
  Once both builds exist, L2 runs in report mode too. Its differences and recording,
  sanity or tool failures are notices with logs and never fail the job.

Exit codes: **0** allowed result; **1** disallowed differences; **2** invalid
input or comparator error. Failed build stages fail the workflow independently
of artifact upload; missing artifacts warn and cannot replace the stage verdict.
In either declared refactor mode, any server difference fails (1), and any failed
recording, sanity check or L2 tool fails (2), even if L3 allows the output change.

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

[Site safety net](../.github/workflows/site-safety-net.yml) selects the full lane
only when the diff touches `applicationSource`: `site/`, `src/`,
`packages/*/src/` or `astro.config.mts`, excluding test/spec modules. Both names
of a rename count. `tool-change` and workflow dispatch force the lane.
Declarations, `refactor`, `compare-build` and an `untangle` branch alone do not
select builds. Docs/tools/test-only changes rely on the changed tools' own
universe tests; the selection job says so in its summary. The declaration gate
still requires a fresh declaration for renames or moves under `site/` or the `refactor` label.
A declaration is honored only when this PR adds or changes it against the
merge base; a stale declaration means report mode.

```json
{
  "mode": "semantic",
  "moves": {},
  "outputs": [{"glob": "earth/index.html", "reason": "Expected Earth content update"}],
  "layout": "none",
  "change": "Name the refactor this declaration belongs to (optional, 1 to 200 characters)"
}
```

`change` names the refactor. It takes part in the freshness comparison, so two pull
requests that otherwise declare the same thing (for example JavaScript-only changes with
no outputs) never carry identical declarations.

The always-running **Refactor declaration gate** requires a fresh declaration
for renames or moves under `site/` or the `refactor` label.
It uses merge-base tooling, needs no dependencies or builds, and remains a real
check when the longer build job is skipped. Selection tools also come from the merge base, except for `tool-change`
or their introducing PR; both exceptions print a warning.

Owner repository settings:

1. Require **Refactor declaration gate** in branch protection; the conditional
   build job is not the enforcement check.
2. Add code-owner entries for `.github/workflows/site-safety-net.yml`,
   `.github/scripts/build-compare/**` and `.github/site-refactor.json` in the
   owner's existing CODEOWNERS; enable **Require review from Code Owners**.
   This change does not add a CODEOWNERS file.
3. Create `tool-change`, `no-base-cache` and `refactor` labels. Restrict label
   management to trusted maintainers. `tool-change` permits head comparison tooling and emits a visible trust-override warning.
4. Save asset caches from main only. PR jobs restore only. An organization
   ruleset requiring the workflow from main adds protection against hostile
   workflow edits that ordinary required-check settings cannot provide.

The gate and build job take all lane tools from the merge base unless
`tool-change` is present. The legacy `tools: head` declaration field is parsed
for compatibility but no longer grants a trust override. The pull request introducing a tool set has no merge-base copy:
it runs its own tools and prints a visible bootstrap warning. An absent
server-answer tool directory has the same exception.
The selected server-answer tools are copied into both checkouts; executable
entries and deployment configuration still come from each revision.

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
All safety-net jobs use Node 24. Cache transfer, new concurrent peak memory
and warm-lane timing remain unmeasured offline.

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
| Server recordings | About 18 MB per target | About 108 MB for three targets on two sides |
| Function/Worker bundles and staged place data | Not measured in this lane | Allow 100 MB across both sides |
| Recording pairs retained for upload | Below 40 MB combined | At most 40 MB extra local copies |
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
working files and the pnpm store: **20 GiB total**, plus **250 MB** for L2
recordings, bundles, staged data, logs and upload copies, and any other generated files.
Copying the prepared bank instead of sharing inodes costs **3.62 GiB** and
prevents head preparation from altering base inputs.
The prepared cache payload is one prepared bank (3.62 GiB). The separate
commit-addressed base archive below shares the repository cache quota with it.

These are historical two-build costs. A cache hit removes every base-side
build, bundle, recording and measurement stage. The 90-minute emergency ceiling
remains; it is not the warm-lane target.

## Hosted measurement and input diagnostics

Measured on 2026-10-05 in PR #1303, head `04a3d7ad61` (this PR),
merge base `19d5ab4958b45877ee30fbca7c1350de4818e8a4`, `ubuntu-latest`,
Node 24, report mode, head tools. Values come from the retained hosted
`site-build-comparison` artifact's `inputs.json` and `timings.json`.

| Stage | Base seconds | Head seconds |
| --- | ---: | ---: |
| Install | 1.6 | 0.8 |
| Preparation | 90.9 | 137.7 |
| Build | 409.1 | 420.1 |
| Compare (both) | 110.0 | — |

The job took approximately 23 minutes; recorded stages total 1,170.2 seconds.
The 46,430 emitted files matched. There were 477 prerender differences
(121 modules, 119 imports, 119 references, 118 membership) and one inventory
difference, `beta-pictoris-disc`. The original report occupied approximately
279 MiB. The artifact retains no output trees or disk-usage measurements, so
checkout/build disk sizes cannot be derived from it.

Verified artifact evidence: `PreparedObjectPanel.astro` lost 118 dynamic
minimap WebP imports on the head, with no additions. This is a file-membership
change, not merely ordering. `ObjectPage.astro` contains different temporary
chunk placeholders; `prepared-source-credits.json` also has different content.
Local retained identical-input proofs report equality, but cannot establish
what was present in the hosted caches.

The restore installer reads inventories and writes restored assets; it does
not rewrite inventories. The deployment nebula CLI, however, calls
`inventoryPreparedAssets` even after `--if-missing` returns a verified reused
bank. That inventories all files actually on disk, replacing the prepared
entries. An extra cached file can therefore change a tracked inventory on
only one side. `beta-pictoris-disc` declares nebula delivery and takes this
path. The old lane disabled prepared sharing if base preparation changed any
inventory. This explains a possible route from cache drift to different
wildcard memberships; the precise original asset entry cannot be recovered
because the hosted artifact contains neither inventory copies nor metadata
input trees. Cache contamination is an inference, not a reproduced hosted
root cause.

Comparison preparation now removes uninventoried files from inventoried
prepared directories before restoring, and omits the nebula authoring step:
restoration supplies the committed bank. It also compares tracked Git diffs
before and after preparation, failing loudly on any new tracked mutation,
including inventory edits. Intentional copied comparison tools are part of
the baseline. Differences remain visible; no glob or import-order
canonicalization was added.

The JSON artifact keeps every difference identity and verdict, with bounded
module/chunk/page samples and omission counts, rather than full manifests,
module code or repeated route lists. Each graph dimension has at most 25
diagnostic entries. Code hunks show the first mismatch with 80 preceding
characters, up to 160 following characters, and both lengths. Import and
reference hunks list added/removed ids (first ten, with omitted counts);
membership hunks show the first ten module locations on both sides.
Inventory diagnostics name changed asset entries without content addresses.
Environment totals and exact emitted HTML/JS/CSS byte equality are recorded
separately. Full build inputs remain the authoritative detail when retained.
The L2 stage copies each comparison output to its checkout’s `dist`, because
its real readers and package isolation require that path. The temporary copy is removed afterward, including on recording failure;
the original evidence tree remains intact for L3 and simultaneous L7. Its
revision-owned Worker bundler also stages place files and `_headers` after L3 comparison. The host routes the build’s
`https://earth-assets.lowpoly.cc` origin through restored inventory files offline;
standalone qualification can use `https://assets.invalid`. No full scene-bank
restore or extra site build is added.

`server-answers.json` records counts, differences, failures and L2 timings. Those
timings also join `timings.json`. The step summary includes per-target counts,
first differences and stage timings. On differences, artifacts include the small
file/dimension summaries, plus both recordings for a differing target only when
all retained recording pairs together stay below 40 MB. Logs are retained even
on failure; missing artifact files warn.

The offline unit dry run exercises four bundle commands, six recordings/checks
and three diffs without a site build. On Node 22.23.2 on macOS, the stubbed
command dry run took 0.034 seconds; the real child-host origin test took
0.131 seconds. These measure orchestration and small fixtures, not site replay.
Hosted addition is estimated at about
5–10 seconds of bundles per side, 90 seconds of recordings per side and a few
seconds of checks/diffs: roughly 3–4 minutes. A shared five-minute subprocess
budget stops unhealthy L2 work; it is a notice in report mode and a failure in
declared modes. Hosted reuse and duration still need the orchestrator’s proof.

CI writes mode, tool origin (merge-base/head/bootstrap), dimensions,
environments, closure sizes and stage timings to `GITHUB_STEP_SUMMARY`.

### Filesystem-order audit

This audit covers all `import.meta.glob` calls under `site/` and `packages/`,
and directory reads in `site/build/**` and top-level `site/*.mts`.
The installed Vite glob transform sorts expanded paths before generating
imports. Sorting them again in the comparator would hide real import-order
changes without explaining missing files.

| Reader | Order and route to prerender |
| --- | --- |
| `ObjectPage.astro` | Globs `prepared/content.json` and `src/**/*.css`; Vite sorts, file membership reaches the named module directly. |
| `PreparedObjectPanel.astro` | Globs minimap JSON/WebPs, surface maps, text, authored content, raster recipes and datasets; Vite sorts, cache membership reaches the named module directly. |
| `dot-catalogue-data.mts` | Eager nebula source glob is sorted by Vite; its values feed prerender catalogue data. |
| `prepare-catalog.mts` | Generates explicit descriptor, prepared datasets/presentation and source-manifest globs; context ids are sorted by `readContextObjects`. These feed prerender context modules. |
| `catalog-directory.ts` (`readObjectDescriptors`) | Raw directory order survives into a descriptor map; `readCatalog` and `readContextObjects` sort their results before catalog generation. No evidence this changes the named modules. |
| `prepare-volume-presentation.mts` | Filters and sorts folders before reading; feeds facility source credits and prepared presentation. |
| `prepare-sidebar-thumbnails.mts` | Both directory scans sort folders; no raw directory-order dependency. |
| `paged-asteroid-dot-positions.mts` | Sorts directories before preparing banks. |
| `prepare-spatial-context.ts` | Cleanup loops use raw directory order but only remove files. Packaged-star discovery preserves raw order into a Set used for membership; no named prerender code-order dependence identified. |
| `check-preparation-inputs.mts` | Raw directory order determines asset-check and missing-file diagnostic order; no named prerender module generation. |
| `pin-world-files.mts` | Raw folder order determines independent inventory writes and counts; authoring command, outside comparison recipe. |
| `refresh-photographs.ts` | Raw recursive order determines refresh processing; authoring command outside comparison recipe. |
| `refresh-content.mts` | Raw order determines independent copied outputs; authoring command outside comparison recipe. |
| `inline-page-stylesheet.mts` | Raw directory order determines independent page processing after emit; cannot change prerender module graph. |
| `deploy/cloudflare/bundle-worker.mts` | Object ids are sorted; scene/name iteration uses raw order for independent copies; excluded deployment command. |
| `object-page-data.mts` | Reads explicit object paths; no directory/glob discovery. Reaches `ObjectPage.astro` directly. |

The same lane runs the [performance guard](performance-guard.md#in-the-comparison-lane) concurrently with server answers after L3 comparison.

## Commit-addressed base reuse

Every push to main runs **Produce commit-addressed production base** with main's
own tools. It installs and prepares once, runs the same pinned production-shaped
comparison build, bundles the two deployment targets, records and sanity-checks
all three L2 targets, and measures L7. Failed qualification never seals or saves
an entry. The key is `site-base-v1-<commit>`; only main saves it, and PRs restore
only the exact merge-base key without prefix matching.

The compressed archive contains `base/` (pre-L2 `dist`, rollup metadata,
inventories, lockfile, toolchain and build record), `server-answers/base/`,
`performance/base/`, `performance/base.md` and `validity.json`. It excludes
prepared/source banks, dependencies, bundles, logs and producer verdicts.
The manifest is written last and lists every payload file's byte length and md5.
A missing/extra file, length/digest mismatch, wrong commit, lockfile or complete
toolchain record rejects the entry. Extraction rejects traversal, links and
special files. Rejection removes partial evidence and runs the fresh base path;
it never skips the lane. Cache hit, miss/fallback or forced fresh is printed,
saved in `cache.json` and included in the job summary. Toolchain changes may
leave an immutable old entry unusable; eviction and cache-service failures also
produce ordinary fresh-base fallbacks.

The producer prints and summarizes the **actual compressed byte count** after
creating `base.tgz`. No production archive exists in this offline checkout,
so its compressed size remains **unmeasured**. Previous local evidence suggests
roughly 4.17 GiB dist + 0.12 GiB metadata + 54 MB recordings before compression;
this is capacity planning, not a measured archive size. Archives below 10 GB
use Actions cache; larger archives or failed cache saves use the named main-run artifact with outer
artifact compression disabled. The PR searches successful main-push runs for
that exact commit on a cache miss. A missing/expired artifact falls back too.
The repository cache quota is shared and entries can be evicted; compression
reduces storage, not that quota.

The head installation starts while Actions restores/downloads the archive;
extraction runs while head preparation/build progresses. Head builds independently,
then its full toolchain/lockfile record is compared with the validated base.
A hit skips base installation, preparation, build, bundles, recordings and measures.
All trusted comparison/diff/measurement entry points execute from the copied
head tool directories, using head's dependencies: a cache hit needs no base install.

After L3, L2 runs its two recordings concurrently (at most three at once), alongside L7.
Preview binds an OS-assigned port (`0`); Cloudflare binds no listening port
and communicates through an independent IPC host. Every recorder has its own
output and temporary directory, inherited by its host.
Bundles finish before recordings; no recorder writes to the retained L3 tree.
The recorder heaps are capped at 512 MiB each, their hosts at 768 MiB,
and L7 at 1536 MiB: at the bound of three, 5.25 GiB of maximum JS heaps on a standard 7 GiB runner,
leaving about 1.75 GiB for native overhead and the supervisor. This makes
three a finite planning bound; hosted peak RSS still needs proof. The existing
shared five-minute L2 deadline, readiness/probe limits and process-group
termination remain. Every parallel target settles even if another fails.

Run `no-base-cache` as a label or the boolean dispatch input to force fresh
base evidence. Keep head, merge base, labels affecting verdicts and tool origin
identical between proof runs. Dispatch on a PR branch compares against its
merge base with `origin/main`. Timing telemetry stays in `timings.json` and
summaries, outside the stable verdict JSON. `comparison.md` is the complete L3
report in Markdown; L7's comparison Markdown remains separately retained.

```sh
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
# Download both hosted site-build-comparison artifacts into these local directories first.
node .github/scripts/build-compare/verify-identical.mts --cached output/proof-cached --fresh output/proof-fresh
```

The identity tool requires a verified cache hit versus a forced fresh base,
then the same base/head/mode/tool origin. It
compares every byte of `report.json`, `server-answers.json`, `performance.json`,
`comparison.md` and L7's comparison JSON/Markdown. Missing files or any difference
fail; it neither normalizes reports nor strips fields.

Run 37296091119's supplied hosted timings total about 30 minutes: base
preparation/build 110/482 s, head preparation/build about 87/498–518 s,
L3 67–74 s, L7 8 s, and sequential two-sided L2 about 4–5 minutes.
The target is roughly **10–12 minutes warm**; this is an estimate, not a result.
Those head costs plus one concurrent L2 critical path suggest about 12 minutes
before runner/setup/upload overhead. The orchestrator must measure archive
bytes, transfer, validation, total duration, memory/disk peaks and byte-identical
reports on hosted runs before claiming the target or identical verdicts.
