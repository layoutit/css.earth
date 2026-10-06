# Source coverage

The site safety net combines Node tests, Chromium browser journeys and preview-server
hits through one source converter. Hits are unioned; percentages are calculated
once, never averaged. WebKit supplies behavior evidence, not V8 coverage.

Use an **unminified build with hidden source maps for coverage**. The build comparison
that checks production equality must keep production minification. On the same
Earth/Mars visits, unminified browser coverage gains 114 lines and 33 branches;
function hits change from 382 to 381. Minifier rewrites otherwise make source-level
floors sensitive to behavior-preserving edits. Unminified maps still have gaps.

## Scope and units

`--scope root` selects 105 tracked TypeScript sources directly under `site/`.
`--scope site` includes its nested TypeScript sources. Tests, declarations, test
helpers and evidence are excluded. `--scope <file.json>` accepts a JSON array of
repository paths; include every source affected by the change. Each summary and
floor stores the scope id and exact file list. Scope changes cannot pass silently.

The TypeScript AST defines the denominator before evidence is read:

- **Lines:** unique lines starting a runtime statement or declaration, including
  each variable declarator, instance field and enum member. Type-only constructs,
  comments, blank lines and continuation lines do not count.
- **Branches:** explicit `if`/`else`, `case`/`default`, `catch`/`finally`, ternary
  arms, logical right operands, loop bodies and each optional-chain continuation
  (`?.property`, `?.()` and `?.[]`). Real V8 fixtures prove zero and positive ranges.
  The optional chain's null outcome and implicit else have no executable arm token.
- **Functions:** each function-like body, anchored on its signature's entry token.
  A never-called nested function cannot mask a called parent's entry.

Default parameter initializers are **excluded**: real V8 runs supply no distinct
range, even when the default executes. Static class fields are excluded because
V8 can assign identical ranges to static and instance initialization with conflicting
counts. Both limits are recorded per source. Expressions inside those excluded
initializers do not create unreachable descendant units.

Never-loaded files retain their complete denominator and zero hits. Empty metrics
have zero hits/units and read as 100%. Missed units carry a line, column, label and
source snippet so further tests can target executable code.

## Evidence and honest limits

[The converter](../.github/scripts/coverage/convert.mts) uses UTF-16 offsets.
The innermost V8 range wins; zero inner ranges override positive outer ranges.
Equal conflicting ranges are ambiguous and yield no hit. Browser source-map
segments attest their original token, not arbitrary gaps to the next mapping.

Node collection captures **actual loaded script text through Inspector**, in test
processes and workers. That independent text is compared with the repository's
position-preserving type-stripped original. Same-length source edits are detected;
reconstructing the source alone is not evidence. Missing captures are diagnosed
and do not supply inferred hits.

Inline functions map only when their exact text occurs once in the type-stripped
repository source. Translation preserves every position; duplicates, ambiguity
and unmatched text are diagnosed. In both measured builds the server bundler
reformats and optimizes `startStartupRequests` and `deferInitialShellContext`, so
**their inline bodies cannot map by this exact-text rule**. Bundled code supplies
12 browser-covered lines in `startup-requests`; `initial-shell-context` remains at
zero. Recovering these inline hits needs an upstream source-preserving emitter or
real maps. This tool does not guess offsets or claim that gap closed.

Astro extracted script modules have a dedicated diagnostic; their text is not the
whole `.astro` template. Astro markup/frontmatter, build-time generation, code the
bundler removed, WebKit-only behavior and paths outside the journeys are unmeasured.
A genuinely stale in-scope map or direct-source record **fails the report**;
legitimately missing mappings remain explicit misses, with diagnostics.

The collector pauses page and worker targets before their first instruction,
captures script sources, and takes precise coverage snapshots before and after
every navigation. A worker terminating between snapshots can lose its last delta;
that limitation is recorded. Anonymous scripts are retained, including harness
scripts that have no repository identity. Those diagnostics do not create hits.

After navigation, collection waits for `document.documentElement.dataset.ready`
to equal `'true'` and, when present, `window.__cssEarth.ready`. It then requires no
active/coasting `objectmotionchange` state and no pending requests for a 750 ms
quiet period. Readiness is bounded at 60 seconds and quiet settling at 30 seconds.
`--wait-ms` changes the quiet period, not a blind startup sleep. External browser
requests are blocked; the local preview supplies the journey bytes.

## Raw contract and compact CI hand-off

Application trees communicate through files, not imports. A raw directory contains
`raw.json`, UTF-8 script files and referenced source-map v3 files:

```json
{
  "version": 1,
  "kind": "browser",
  "root": "/absolute/checkout",
  "costMs": 8000,
  "issues": [],
  "scripts": [{
    "url": "http://127.0.0.1:4210/_astro/example.js",
    "source": "scripts/1.js",
    "map": "scripts/1.map",
    "mapBase": "/absolute/comparison/dist/_astro/example.js",
    "context": "worker:navigation-2",
    "functions": [{
      "functionName": "example",
      "isBlockCoverage": true,
      "ranges": [{ "startOffset": 0, "endOffset": 20, "count": 1 }]
    }]
  }]
}
```

`sourcePath` optionally identifies a direct repository source. Required fields,
relative paths, nonnegative integer counts, half-open ranges and source-map fields
are runtime-validated. Every range must fit its script and containing function.
Store one record per snapshot; union records instead of averaging or overwriting.

Browser directories also require `collection.json` with `navigation` URL strings
and `navigationSteps`: `{ "url": "...", "step": 1, "workersExpected": true }`.
A harness must independently observe worker creation to set that flag. The validator
requires a page snapshot for each step and a worker snapshot when expected, and
opens every referenced source/map file. It cannot detect an emitter that lies
about worker observation. [Conformance tests](../.github/scripts/coverage/validator.test.mts)
exercise missing navigations, workers and maps.

Node records and source bytes are deduplicated by repository path. Each snapshot
first resolves its own innermost V8 ranges; positive intervals are then unioned.
A single path record preserves those union hits without inventing inherited hits.
Browser records retain separate snapshots. Collection converts in the same job, then removes temporary
Inspector copies and V8 dumps. `summary.json` is the **job artifact**, not the raw
directory: `{ version, kind, qualified, costMs, files, unmapped }`, with each file
holding `{ file, source, loaded, hits }`. `hits` is the set of stable AST unit ids
(kind, source offset, label). Source text verifies identity without a digest.
Readers reject stale text, unknown/duplicate ids and a differing file set. Raw
browser/server evidence is retained locally for audit, not uploaded between jobs.

## Complete collection and CI steps

Start at the checkout root with installed dependencies and locally restored prepared
inputs. The collection jobs need those inputs; a coverage report cannot restore
missing scientific data. Use a new run directory. This sequence builds and converts
in the collection job, then demonstrates the separate summary-only merge job.

```sh
set -eu
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
RUN_DIR="$PWD/output/coverage/run-$(date +%s)"
mkdir -p "$RUN_DIR/tmp" "$RUN_DIR/server/v8" "$RUN_DIR/server/captured"
export TMPDIR="$RUN_DIR/tmp"
cat > "$RUN_DIR/unminified.config.mts" <<'TS'
import { defineConfig } from 'astro/config';
import { pathToFileURL } from 'node:url';
const { default: original } = await import(pathToFileURL(`${process.cwd()}/site/astro.config.mts`).href);
export default defineConfig({ ...original, vite: {
  ...original.vite,
  build: { ...original.vite?.build, minify: false, sourcemap: 'hidden' },
  plugins: [...(original.vite?.plugins ?? []), {
    name: 'coverage-environments',
    configEnvironment: () => ({ build: { minify: false, sourcemap: 'hidden' } }),
  }],
  worker: { ...original.vite?.worker, plugins: () => [
    ...(original.vite?.worker?.plugins?.() ?? []), {
      name: 'coverage-worker-maps',
      config: () => ({ build: { minify: false, sourcemap: 'hidden' } }),
    },
  ] },
} });
TS
NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build \
  --config "$RUN_DIR/unminified.config.mts" --outDir "$RUN_DIR/dist"
cat > "$RUN_DIR/preview.mts" <<'TS'
import { pathToFileURL } from 'node:url';
const { previewSite } = await import(pathToFileURL(`${process.cwd()}/site/server/preview.mts`).href);
const server = await previewSite({ root: process.cwd(), outDir: process.argv[2], port: Number(process.argv[3]) });
server.printUrls();
process.once('SIGTERM', async () => { await server.close(); process.exit(0); });
TS
pnpm coverage:node --scope root --out "$RUN_DIR/node"                          # (1)
node .github/scripts/coverage/collect-browser.mts \
  --dist "$RUN_DIR/dist" --out "$RUN_DIR/browser" \
  --urls '["/earth-system/","/mars-system/"]' \
  --server-command "[\"env\",\"NODE_V8_COVERAGE=$RUN_DIR/server/v8\",\"COVERAGE_SOURCE_DIR=$RUN_DIR/server/captured\",\"COVERAGE_SOURCE_ROOT=$PWD\",\"NODE_OPTIONS=--import=$PWD/.github/scripts/coverage/node-source.mts\",\"node\",\"$RUN_DIR/preview.mts\",\"{dist}\",\"{port}\"]"
node .github/scripts/coverage/collect-node.mts \
  --normalize "$RUN_DIR/server/v8" --out "$RUN_DIR/server" --kind server
node .github/scripts/coverage/summarize.mts \
  --raw "$RUN_DIR/browser" --scope root --out "$RUN_DIR/browser/summary.json"
node .github/scripts/coverage/summarize.mts \
  --raw "$RUN_DIR/server" --scope root --out "$RUN_DIR/server/summary.json"
rm -rf "$RUN_DIR/dist" "$RUN_DIR/server/v8" "$RUN_DIR/server/captured"
# Upload only node/summary.json, browser/summary.json and server/summary.json.
# Merge job: download those three artifacts with the same checkout revision.
pnpm coverage:report --scope root --files --out "$RUN_DIR/union.json" \
  "$RUN_DIR/node/summary.json" "$RUN_DIR/browser/summary.json" "$RUN_DIR/server/summary.json"
pnpm coverage:ratchet --check "$RUN_DIR/union.json" --base origin/main           # (2)
```

(1) The default command is the site-only test glob through `pnpm test:run`, retaining
both preloads, mocks, four-way concurrency and the test timeout. Broad `test:site`
can be supplied after `--`; it tests additional owners without improving root hits
in the original comparison. Failing commands retain unqualified evidence and exit
nonzero; stop the job. This worktree lacks the M57/NGC 3132 prepared dataset ids
needed by “every registered object has publishable reader text, and its published
copies are current”. Local five-run measurement explicitly excluded **that named
test** with `--test-skip-pattern`; 658 tests ran, 651 passed and seven source-input
tests skipped. No failing run seeded floors. CI should restore inputs and run its
normal command; the exclusion is a local measurement limitation, not a default.

(2) The merge job must have the base ref already available. `--check` checks measured
floors; `--base` checks the committed floor change against that ref. Neither step
requires a network fetch. No workflow is added here; these exact steps still need
integration into the shared lane. `--require-targets` adds the target gate when
characterization reaches them. Pass the same explicit file-list scope to all jobs
when the change touches additional sources.

## Floors, targets and measured gap

The [floors](../.github/coverage-ratchet.json) store the scope id, exact file list,
aggregate floors and each eligible file's floors. `--check` fails below a floor,
with a missing eligible floor, a retired path still in scope, a newly exempt floored
file, an unqualified run or a differing stored scope.

`--update <summary.json>` raises existing floors only. An array of at least three
qualified summaries takes the **minimum** across runs independently for each
per-file and aggregate metric, then rounds down to 0.1. Never average them. A
failing member rejects the whole array. This baseline uses five passing collections
per source and five corresponding union summaries.

Disappearance requires `--move-map <file.json>` (`old: new`) or `--retired <file.json>`.
Reasons are `deleted`, `moved`, `merged-into:<path>` or `exempt:<reason>`.
The base check reads tracked head paths: newly retired paths must be absent, moved
paths must be absent and their final target must exist, and merge targets must
exist. Histories persist; lowering, unexplained deletion and rewritten history fail.
Cycles fail fast, with isolated-process tests bounded to five seconds. An invalid
base ref fails; a valid base predating initial floors permits introduction.

Report move maps rebase old identities only when the original source is unchanged.
Regenerate maps after an edit. Moves do not reset floors or denominators.

Baseline before L5 (revision `518b6249fd`):

| Source | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| Node | 2519/3811 (66.10%) | 1349/2510 (53.75%) | 631/1074 (58.75%) |
| Unminified browser | 1387/3811 (36.39%) | 517/2510 (20.60%) | 381/1074 (35.47%) |
| Preview server | 248/3811 (6.51%) | 80/2510 (3.19%) | 36/1074 (3.35%) |
| Union | **3102/3811 (81.40%)** | **1559/2510 (62.11%)** | **796/1074 (74.12%)** |

Application sources are revision `518b6249fd`, Node 22.23.2; the accompanying
coverage tooling includes these fixes. Application sources are unchanged.
The baseline floors were 81.3/62.1/74.1. The targets remain **90% lines, 85% branches and 85%
lines per file**. The union needs 328 additional lines and 575 branches; 35 files
remain below the per-file target, and six were never loaded. Functions are reported
and ratcheted without a separate target.

After the L5 characterization tests (revision `f6b4c85cab`, Node 22.23.2, three identical node collections unioned with the browser and
preview-server collections of the baseline; the new tests change only Node hits), the union is
**3777/3811 lines (99.11%)**, **2306/2510 branches (91.87%)** and **1042/1074 functions (97.02%)**. The floors are
99.1/91.9/97.0 (after the L6 deletion of `site/scientific-chart-order.mts`, which nothing imported) and every per-file floor was raised to the minimum of the three runs. Both targets are met in aggregate.
One eligible file is below 85% lines, `site/server/dot-catalogue-data.mts` (0 of 11): it is a Vite-only `import.meta.glob` module that
plain Node cannot evaluate, so its behavior is pinned by a test that runs it in a child process under a hook and no hit is
recorded. Three files are never loaded. The largest remaining branch gaps are `prepared-world-navigation` 48, `dataset-response` 14,
`arrival-billboard` 13 and `source-documentation` 13.

The explicit [build exemptions](../.github/scripts/coverage/build-exemptions.json)
cover 13 preparation entry points requiring restored scientific inputs. They remain
reported but outside percentage targets and floors; the build comparison pins
emitted output. Root scope contains no exemptions. Other build modules stay eligible.

## Validation and cost

Real V8 fixtures cover optional property, call and element continuations; defaults
and conflicting static/instance ranges demonstrate the stated limits. A deliberately
uncovered default-path arm is missed and flips to hit when its range executes.
The browser build maps the world-context invalid-window throw as missed. Never-loaded
`learn-more` retains 0/6 lines, 0/1 branches and 0/1 functions. Shared-file union hits
are at least each source contribution. Worker snapshots and both navigations are
present in every browser run. Guard-removal mutations exercise the ratchet and
mapping guarantees, including the hand-edit retirement attack and cycle termination.

A fresh **passing** Node run with simultaneous LCOV and V8 capture shows **98.49%**
executable-line hit agreement (3133/3181). Physical LCOV lines include comments and
continuations; partly executed lines can disagree with a first-token AST unit.
Node branch/function denominators contain observed V8 blocks/functions, while this
report includes all eligible source arms/functions, including never-loaded code.
[The comparator](../.github/scripts/coverage/compare-node.mts) reports each file and
every differing line. These denominators must not be presented as interchangeable.

| Stage | Measured local cost |
| --- | ---: |
| Unminified comparison build | 4m 52s; 14 GB temporary dist, deleted after collection |
| Node collection, normalization and conversion | 64.96–76.76 s per run |
| Unminified browser + real preview + conversions | 7.40–9.93 s per run |
| Minified browser + real preview + conversions | 7.23–8.07 s per run |
| Server normalization/conversion | 0.115–0.165 s, inside the browser-stage total |
| Summary-only union/report | **0.61 s** |

Five runs were measured per collector/build. Node source copies shrink from
814,951,855 bytes (5,627 copies) to 39,583,005 bytes (526 paths), a 95.1% reduction.
The new raw Node directory is 41 MB versus the previous 1.0 GB, including removal
of temporary captures and V8 dumps. Raw snapshot metadata shrinks from about 52 MB to 1.30 MB. Snapshot compaction
was verified to preserve every root hit unit in all fifteen Node/server runs. A
fresh final-collector run also passed in 74.05 s with identical root hit sets.
The Node/browser/server summary artifacts total **1.81 MB**, instead of uploading
raw evidence or the comparison dist. Build, prepared-input setup and installation
costs belong to the collection job; the supplied minified build's original build
time was not measured. These are local wall times, not CI queue latency.

## Five-run per-file variance

Each cell is `minimum–maximum hits / denominator` for **lines; branches; functions**.
Every unit's hit bit was compared across all five runs, not only total percentages.
Node, unminified browser and both server-build sets are stable. The only changing
unit is minified `object-entries` at line 25, column 41 (`loop`): missed, missed,
hit, missed, hit. Floors use unminified runs, so this variance is not seeded.
Both server build sets have identical per-file results; one server column suffices.
| File | Node L/B/F | Browser unminified L/B/F | Browser minified L/B/F | Server L/B/F |
| --- | --- | --- | --- | --- |
| application-world-context.mts | 0–0/91; 0–0/44; 0–0/31 | 55–55/91; 9–9/44; 8–8/31 | 53–53/91; 8–8/44; 8–8/31 | 0–0/91; 0–0/44; 0–0/31 |
| application-world-frames.mts | 26–26/36; 19–19/28; 11–11/18 | 27–27/36; 17–17/28; 9–9/18 | 23–23/36; 17–17/28; 9–9/18 | 0–0/36; 0–0/28; 0–0/18 |
| application-world-resources.mts | 0–0/134; 0–0/59; 0–0/65 | 98–98/134; 34–34/59; 44–44/65 | 97–97/134; 33–33/59; 44–44/65 | 0–0/134; 0–0/59; 0–0/65 |
| application-world-types.mts | 0–0/0; 0–0/0; 0–0/0 | 0–0/0; 0–0/0; 0–0/0 | 0–0/0; 0–0/0; 0–0/0 | 0–0/0; 0–0/0; 0–0/0 |
| application-world-visibility.mts | 81–81/86; 47–47/55; 35–35/38 | 54–54/86; 30–30/55; 30–30/38 | 51–51/86; 29–29/55; 30–30/38 | 0–0/86; 0–0/55; 0–0/38 |
| arrival-billboard.mts | 54–54/55; 20–20/33; 10–10/11 | 0–0/55; 0–0/33; 0–0/11 | 0–0/55; 0–0/33; 0–0/11 | 0–0/55; 0–0/33; 0–0/11 |
| asset-origin.mts | 98–98/124; 50–50/86; 18–18/24 | 0–0/124; 0–0/86; 0–0/24 | 0–0/124; 0–0/86; 0–0/24 | 0–0/124; 0–0/86; 0–0/24 |
| built-pages.mts | 30–30/30; 15–15/16; 13–13/13 | 0–0/30; 0–0/16; 0–0/13 | 0–0/30; 0–0/16; 0–0/13 | 0–0/30; 0–0/16; 0–0/13 |
| catalogue-moon-labels.mts | 43–43/115; 16–16/63; 7–7/28 | 67–67/115; 11–11/63; 20–20/28 | 66–66/115; 11–11/63; 20–20/28 | 0–0/115; 0–0/63; 0–0/28 |
| chart-pixel-alignment.mts | 41–41/41; 20–20/24; 8–8/9 | 3–3/41; 1–1/24; 2–2/9 | 3–3/41; 1–1/24; 2–2/9 | 0–0/41; 0–0/24; 0–0/9 |
| context-availability.mts | 0–0/2; 0–0/0; 0–0/0 | 1–1/2; 0–0/0; 0–0/0 | 1–1/2; 0–0/0; 0–0/0 | 0–0/2; 0–0/0; 0–0/0 |
| context-datasets.mts | 1–1/1; 0–0/0; 0–0/0 | 1–1/1; 0–0/0; 0–0/0 | 1–1/1; 0–0/0; 0–0/0 | 0–0/1; 0–0/0; 0–0/0 |
| dataset-content.mts | 7–7/7; 8–8/9; 1–1/1 | 0–0/7; 0–0/9; 0–0/1 | 0–0/7; 0–0/9; 0–0/1 | 0–0/7; 0–0/9; 0–0/1 |
| dataset-context.mts | 1–1/20; 0–0/27; 0–0/14 | 0–0/20; 0–0/27; 0–0/14 | 0–0/20; 0–0/27; 0–0/14 | 0–0/20; 0–0/27; 0–0/14 |
| dataset-picker.mts | 11–11/21; 4–4/9; 4–4/8 | 14–14/21; 3–3/9; 4–4/8 | 14–14/21; 3–3/9; 4–4/8 | 0–0/21; 0–0/9; 0–0/8 |
| dataset-response.mts | 108–108/122; 55–55/88; 17–17/18 | 0–0/122; 0–0/88; 0–0/18 | 0–0/122; 0–0/88; 0–0/18 | 14–14/122; 0–0/88; 0–0/18 |
| dataset-url.mts | 18–18/18; 7–7/7; 5–5/5 | 5–5/18; 1–1/7; 2–2/5 | 5–5/18; 1–1/7; 2–2/5 | 0–0/18; 0–0/7; 0–0/5 |
| default-width-share.mts | 5–5/5; 9–9/14; 1–1/1 | 0–0/5; 0–0/14; 0–0/1 | 0–0/5; 0–0/14; 0–0/1 | 0–0/5; 0–0/14; 0–0/1 |
| destination-browser.mts | 26–26/26; 9–9/10; 3–3/3 | 24–24/26; 8–8/10; 3–3/3 | 20–20/26; 8–8/10; 3–3/3 | 0–0/26; 0–0/10; 0–0/3 |
| diagnostic-recorder.mts | 65–65/99; 18–18/72; 16–16/35 | 0–0/99; 0–0/72; 0–0/35 | 0–0/99; 0–0/72; 0–0/35 | 0–0/99; 0–0/72; 0–0/35 |
| diagnostics-policy.mts | 1–1/1; 1–1/3; 0–0/0 | 0–0/1; 0–0/3; 0–0/0 | 0–0/1; 0–0/3; 0–0/0 | 0–0/1; 0–0/3; 0–0/0 |
| dot-catalogue-data.mts | 0–0/11; 0–0/1; 0–0/4 | 0–0/11; 0–0/1; 0–0/4 | 0–0/11; 0–0/1; 0–0/4 | 0–0/11; 0–0/1; 0–0/4 |
| dot-catalogues.mts | 0–0/3; 0–0/0; 0–0/1 | 0–0/3; 0–0/0; 0–0/1 | 0–0/3; 0–0/0; 0–0/1 | 0–0/3; 0–0/0; 0–0/1 |
| error-report.mts | 1–1/1; 0–0/0; 0–0/0 | 0–0/1; 0–0/0; 0–0/0 | 0–0/1; 0–0/0; 0–0/0 | 0–0/1; 0–0/0; 0–0/0 |
| exploration-catalog.mts | 0–0/4; 0–0/0; 0–0/0 | 0–0/4; 0–0/0; 0–0/0 | 0–0/4; 0–0/0; 0–0/0 | 0–0/4; 0–0/0; 0–0/0 |
| feature-browser.mts | 19–19/19; 9–9/13; 5–5/5 | 10–10/19; 0–0/13; 3–3/5 | 9–9/19; 0–0/13; 3–3/5 | 0–0/19; 0–0/13; 0–0/5 |
| first-view-transport.mts | 18–18/22; 11–11/16; 5–5/6 | 0–0/22; 0–0/16; 0–0/6 | 0–0/22; 0–0/16; 0–0/6 | 0–0/22; 0–0/16; 0–0/6 |
| hosted-banks.mts | 17–17/18; 18–18/21; 5–5/5 | 0–0/18; 0–0/21; 0–0/5 | 0–0/18; 0–0/21; 0–0/5 | 0–0/18; 0–0/21; 0–0/5 |
| import-queue.mts | 10–10/10; 1–1/1; 4–4/5 | 10–10/10; 1–1/1; 1–1/5 | 10–10/10; 1–1/1; 1–1/5 | 5–5/10; 0–0/1; 1–1/5 |
| in-flight-loader.mts | 10–10/10; 2–2/2; 4–4/4 | 3–3/10; 0–0/2; 1–1/4 | 3–3/10; 0–0/2; 2–2/4 | 0–0/10; 0–0/2; 0–0/4 |
| information-card.mts | 21–21/66; 9–9/31; 7–7/26 | 39–39/66; 4–4/31; 12–12/26 | 37–37/66; 4–4/31; 12–12/26 | 0–0/66; 0–0/31; 0–0/26 |
| initial-scene.mts | 0–0/14; 0–0/7; 0–0/6 | 2–2/14; 1–1/7; 1–1/6 | 2–2/14; 1–1/7; 1–1/6 | 0–0/14; 0–0/7; 0–0/6 |
| initial-shell-context.mts | 7–7/7; 3–3/4; 3–3/3 | 0–0/7; 0–0/4; 0–0/3 | 0–0/7; 0–0/4; 0–0/3 | 0–0/7; 0–0/4; 0–0/3 |
| inside-view.mts | 31–31/45; 20–20/41; 6–6/13 | 16–16/45; 16–16/41; 6–6/13 | 14–14/45; 14–14/41; 6–6/13 | 13–13/45; 0–0/41; 0–0/13 |
| layout-sections.mts | 0–0/10; 0–0/2; 0–0/2 | 8–8/10; 2–2/2; 1–1/2 | 8–8/10; 2–2/2; 1–1/2 | 0–0/10; 0–0/2; 0–0/2 |
| learn-more.mts | 0–0/6; 0–0/1; 0–0/1 | 0–0/6; 0–0/1; 0–0/1 | 0–0/6; 0–0/1; 0–0/1 | 0–0/6; 0–0/1; 0–0/1 |
| moon-orbit-policy.mts | 0–0/7; 0–0/1; 0–0/3 | 6–6/7; 1–1/1; 2–2/3 | 5–5/7; 1–1/1; 2–2/3 | 0–0/7; 0–0/1; 0–0/3 |
| narrow-layout.mts | 1–1/1; 0–0/0; 0–0/0 | 1–1/1; 0–0/0; 0–0/0 | 1–1/1; 0–0/0; 0–0/0 | 0–0/1; 0–0/0; 0–0/0 |
| native-input.mts | 10–10/10; 0–0/0; 1–1/1 | 0–0/10; 0–0/0; 0–0/1 | 0–0/10; 0–0/0; 0–0/1 | 0–0/10; 0–0/0; 0–0/1 |
| native-view-forms.mts | 0–0/23; 0–0/13; 0–0/5 | 5–5/23; 0–0/13; 1–1/5 | 5–5/23; 0–0/13; 1–1/5 | 0–0/23; 0–0/13; 0–0/5 |
| next-frame.mts | 5–5/6; 2–2/3; 3–3/3 | 0–0/6; 0–0/3; 0–0/3 | 0–0/6; 0–0/3; 0–0/3 | 0–0/6; 0–0/3; 0–0/3 |
| object-adapter.mts | 4–4/18; 0–0/11; 2–2/4 | 9–9/18; 1–1/11; 1–1/4 | 9–9/18; 1–1/11; 1–1/4 | 0–0/18; 0–0/11; 0–0/4 |
| object-browser.mts | 0–0/215; 0–0/113; 0–0/48 | 71–71/215; 9–9/113; 4–4/48 | 66–66/215; 8–8/113; 4–4/48 | 0–0/215; 0–0/113; 0–0/48 |
| object-children.mts | 31–31/31; 34–34/38; 15–15/15 | 0–0/31; 0–0/38; 0–0/15 | 0–0/31; 0–0/38; 0–0/15 | 0–0/31; 0–0/38; 0–0/15 |
| object-classification-label.mts | 0–0/5; 0–0/3; 0–0/2 | 0–0/5; 0–0/3; 0–0/2 | 0–0/5; 0–0/3; 0–0/2 | 0–0/5; 0–0/3; 0–0/2 |
| object-directory.mts | 49–49/57; 16–16/21; 17–17/19 | 43–43/57; 10–10/21; 16–16/19 | 41–41/57; 10–10/21; 16–16/19 | 7–7/57; 0–0/21; 0–0/19 |
| object-entries.mts | 21–21/28; 3–3/18; 4–4/7 | 20–20/28; 2–2/18; 2–2/7 | 19–19/28; 2–3/18 (1 varies); 2–2/7 | 3–3/28; 0–0/18; 0–0/7 |
| object-entry.mts | 8–8/8; 3–3/5; 4–4/4 | 0–0/8; 0–0/5; 0–0/4 | 0–0/8; 0–0/5; 0–0/4 | 0–0/8; 0–0/5; 0–0/4 |
| object-page-contract.mts | 7–7/7; 9–9/10; 3–3/3 | 0–0/7; 0–0/10; 0–0/3 | 0–0/7; 0–0/10; 0–0/3 | 0–0/7; 0–0/10; 0–0/3 |
| object-page-data.mts | 48–48/62; 14–14/33; 7–7/12 | 0–0/62; 0–0/33; 0–0/12 | 0–0/62; 0–0/33; 0–0/12 | 0–0/62; 0–0/33; 0–0/12 |
| object-shell-types.ts | 0–0/0; 0–0/0; 0–0/0 | 0–0/0; 0–0/0; 0–0/0 | 0–0/0; 0–0/0; 0–0/0 | 0–0/0; 0–0/0; 0–0/0 |
| object-systems.mts | 40–40/40; 17–17/22; 9–9/9 | 31–31/40; 11–11/22; 7–7/9 | 30–30/40; 10–10/22; 7–7/9 | 11–11/40; 0–0/22; 0–0/9 |
| object-text.mts | 106–106/118; 34–34/55; 25–25/27 | 0–0/118; 0–0/55; 0–0/27 | 0–0/118; 0–0/55; 0–0/27 | 0–0/118; 0–0/55; 0–0/27 |
| objects.mts | 15–15/15; 3–3/4; 5–5/5 | 0–0/15; 0–0/4; 0–0/5 | 0–0/15; 0–0/4; 0–0/5 | 0–0/15; 0–0/4; 0–0/5 |
| orbit-root.mts | 6–6/6; 2–2/2; 1–1/1 | 5–5/6; 2–2/2; 1–1/1 | 5–5/6; 2–2/2; 1–1/1 | 0–0/6; 0–0/2; 0–0/1 |
| overview-selection.mts | 75–75/75; 61–61/74; 20–20/20 | 37–37/75; 13–13/74; 12–12/20 | 33–33/75; 12–12/74; 12–12/20 | 0–0/75; 0–0/74; 0–0/20 |
| packaged-object-runtime.mts | 0–0/28; 0–0/12; 0–0/5 | 15–15/28; 5–5/12; 5–5/5 | 15–15/28; 4–4/12; 5–5/5 | 0–0/28; 0–0/12; 0–0/5 |
| planetary-system-members.mts | 14–14/14; 8–8/8; 6–6/6 | 12–12/14; 7–7/8; 6–6/6 | 12–12/14; 7–7/8; 6–6/6 | 2–2/14; 0–0/8; 0–0/6 |
| prepare-body-moons.mts | 25–25/27; 6–6/8; 10–10/12 | 0–0/27; 0–0/8; 0–0/12 | 0–0/27; 0–0/8; 0–0/12 | 0–0/27; 0–0/8; 0–0/12 |
| prepared-arrival.mts | 46–46/46; 22–22/27; 5–5/5 | 0–0/46; 0–0/27; 0–0/5 | 0–0/46; 0–0/27; 0–0/5 | 0–0/46; 0–0/27; 0–0/5 |
| prepared-descriptor.mts | 12–12/12; 3–3/4; 2–2/2 | 7–7/12; 0–0/4; 1–1/2 | 7–7/12; 0–0/4; 1–1/2 | 0–0/12; 0–0/4; 0–0/2 |
| prepared-object-path.mts | 7–7/7; 2–2/3; 2–2/2 | 5–5/7; 1–1/3; 2–2/2 | 5–5/7; 1–1/3; 2–2/2 | 0–0/7; 0–0/3; 0–0/2 |
| prepared-panel-content.mts | 36–36/54; 41–41/70; 12–12/20 | 0–0/54; 0–0/70; 0–0/20 | 0–0/54; 0–0/70; 0–0/20 | 0–0/54; 0–0/70; 0–0/20 |
| prepared-scene-ownership.mts | 23–23/23; 7–7/9; 5–5/5 | 0–0/23; 0–0/9; 0–0/5 | 0–0/23; 0–0/9; 0–0/5 | 0–0/23; 0–0/9; 0–0/5 |
| prepared-world-navigation.mts | 319–319/353; 240–240/337; 66–66/75 | 75–75/353; 31–31/337; 16–16/75 | 68–68/353; 30–30/337; 16–16/75 | 0–0/353; 0–0/337; 0–0/75 |
| prepared-world-presentation.mts | 26–26/29; 21–21/31; 9–9/9 | 24–24/29; 20–20/31; 9–9/9 | 24–24/29; 20–20/31; 9–9/9 | 26–26/29; 21–21/31; 9–9/9 |
| root-object.mts | 7–7/7; 4–4/4; 2–2/2 | 3–3/7; 2–2/4; 1–1/2 | 3–3/7; 2–2/4; 1–1/2 | 2–2/7; 0–0/4; 0–0/2 |
| runtime-policy.mts | 76–76/83; 43–43/55; 10–10/12 | 39–39/83; 16–16/55; 5–5/12 | 32–32/83; 14–14/55; 5–5/12 | 27–27/83; 0–0/55; 0–0/12 |
| satellite-selection.mts | 14–14/14; 10–10/11; 2–2/2 | 11–11/14; 3–3/11; 2–2/2 | 9–9/14; 3–3/11; 2–2/2 | 0–0/14; 0–0/11; 0–0/2 |
| satellite-systems.mts | 27–27/27; 15–15/16; 11–11/12 | 24–24/27; 11–11/16; 10–10/12 | 24–24/27; 11–11/16; 10–10/12 | 0–0/27; 0–0/16; 0–0/12 |
| scientific-chart-order.mts | 9–9/9; 6–6/8; 5–5/5 | 0–0/9; 0–0/8; 0–0/5 | 0–0/9; 0–0/8; 0–0/5 | 0–0/9; 0–0/8; 0–0/5 |
| selection-presentation.mts | 29–29/29; 19–19/23; 6–6/8 | 21–21/29; 16–16/23; 7–7/8 | 16–16/29; 15–15/23; 7–7/8 | 5–5/29; 0–0/23; 0–0/8 |
| seo-trail.mts | 3–3/3; 0–0/0; 2–2/2 | 0–0/3; 0–0/0; 0–0/2 | 0–0/3; 0–0/0; 0–0/2 | 0–0/3; 0–0/0; 0–0/2 |
| seo.mts | 10–10/15; 2–2/7; 5–5/6 | 9–9/15; 3–3/7; 2–2/6 | 7–7/15; 3–3/7; 2–2/6 | 0–0/15; 0–0/7; 0–0/6 |
| shared-imports.mts | 0–0/5; 0–0/0; 0–0/3 | 3–3/5; 0–0/0; 0–0/3 | 3–3/5; 0–0/0; 0–0/3 | 0–0/5; 0–0/0; 0–0/3 |
| showcase.mts | 55–55/58; 24–24/30; 15–15/15 | 10–10/58; 0–0/30; 1–1/15 | 10–10/58; 0–0/30; 1–1/15 | 0–0/58; 0–0/30; 0–0/15 |
| sidebar-thumbnails.mts | 0–0/12; 0–0/6; 0–0/2 | 0–0/12; 0–0/6; 0–0/2 | 0–0/12; 0–0/6; 0–0/2 | 0–0/12; 0–0/6; 0–0/2 |
| social-images.mts | 15–15/16; 5–5/6; 6–6/6 | 0–0/16; 0–0/6; 0–0/6 | 0–0/16; 0–0/6; 0–0/6 | 0–0/16; 0–0/6; 0–0/6 |
| source-documentation.mts | 51–51/53; 30–30/43; 7–7/10 | 0–0/53; 0–0/43; 0–0/10 | 0–0/53; 0–0/43; 0–0/10 | 0–0/53; 0–0/43; 0–0/10 |
| source-icons.mts | 8–8/10; 7–7/10; 3–3/3 | 0–0/10; 0–0/10; 0–0/3 | 0–0/10; 0–0/10; 0–0/3 | 0–0/10; 0–0/10; 0–0/3 |
| source-link.mts | 13–13/13; 9–9/10; 4–4/4 | 12–12/13; 10–10/10; 4–4/4 | 8–8/13; 10–10/10; 4–4/4 | 1–1/13; 0–0/10; 0–0/4 |
| startup-billboard.mts | 15–15/46; 4–4/35; 3–3/8 | 17–17/46; 4–4/35; 3–3/8 | 20–20/46; 4–4/35; 3–3/8 | 0–0/46; 0–0/35; 0–0/8 |
| startup-boot.mts | 0–0/12; 0–0/4; 0–0/7 | 11–11/12; 2–2/4; 5–5/7 | 9–9/12; 2–2/4; 5–5/7 | 0–0/12; 0–0/4; 0–0/7 |
| startup-cover.mts | 21–21/42; 18–18/37; 2–2/5 | 0–0/42; 0–0/37; 0–0/5 | 0–0/42; 0–0/37; 0–0/5 | 0–0/42; 0–0/37; 0–0/5 |
| startup-requests.mts | 27–27/37; 17–17/24; 8–8/11 | 12–12/37; 2–2/24; 3–3/11 | 10–10/37; 1–1/24; 3–3/11 | 2–2/37; 0–0/24; 0–0/11 |
| startup-world.mts | 5–5/31; 0–0/35; 0–0/10 | 25–25/31; 20–20/35; 9–9/10 | 24–24/31; 20–20/35; 9–9/10 | 5–5/31; 0–0/35; 0–0/10 |
| stellar-extents.mts | 8–8/8; 6–6/6; 2–2/2 | 6–6/8; 4–4/6; 2–2/2 | 6–6/8; 4–4/6; 2–2/2 | 0–0/8; 0–0/6; 0–0/2 |
| system-card.mts | 24–24/24; 14–14/16; 10–10/10 | 0–0/24; 0–0/16; 0–0/10 | 0–0/24; 0–0/16; 0–0/10 | 0–0/24; 0–0/16; 0–0/10 |
| system-framing-radii.mts | 22–22/22; 25–25/28; 4–4/4 | 21–21/22; 18–18/28; 4–4/4 | 19–19/22; 16–16/28; 4–4/4 | 22–22/22; 25–25/28; 4–4/4 |
| system-framing.mts | 133–133/144; 64–64/84; 43–43/45 | 88–88/144; 53–53/84; 24–24/45 | 82–82/144; 50–50/84; 24–24/45 | 45–45/144; 17–17/84; 13–13/45 |
| tab-panels.mts | 12–12/25; 7–7/16; 3–3/7 | 18–18/25; 3–3/16; 4–4/7 | 16–16/25; 2–2/16; 4–4/7 | 0–0/25; 0–0/16; 0–0/7 |
| view-readout.mts | 14–14/109; 0–0/71; 1–1/31 | 79–79/109; 38–38/71; 17–17/31 | 61–61/109; 34–34/71; 17–17/31 | 0–0/109; 0–0/71; 0–0/31 |
| view-url-runtime.mts | 52–52/58; 14–14/29; 10–10/12 | 48–48/58; 15–15/29; 8–8/12 | 36–36/58; 12–12/29; 8–8/12 | 0–0/58; 0–0/29; 0–0/12 |
| volume-presentation.mts | 17–17/17; 11–11/11; 5–5/5 | 0–0/17; 0–0/11; 0–0/5 | 0–0/17; 0–0/11; 0–0/5 | 0–0/17; 0–0/11; 0–0/5 |
| web-analytics.mts | 2–2/2; 0–0/0; 0–0/0 | 0–0/2; 0–0/0; 0–0/0 | 0–0/2; 0–0/0; 0–0/0 | 0–0/2; 0–0/0; 0–0/0 |
| world-approach.mts | 0–0/37; 0–0/21; 0–0/9 | 32–32/37; 16–16/21; 5–5/9 | 27–27/37; 13–13/21; 5–5/9 | 0–0/37; 0–0/21; 0–0/9 |
| world-camera.mts | 0–0/2; 0–0/5; 0–0/0 | 2–2/2; 2–2/5; 0–0/0 | 2–2/2; 2–2/5; 0–0/0 | 0–0/2; 0–0/5; 0–0/0 |
| world-context-plan.mts | 58–58/82; 17–17/47; 14–14/26 | 50–50/82; 15–15/47; 14–14/26 | 47–47/82; 13–13/47; 14–14/26 | 41–41/82; 14–14/47; 7–7/26 |
| world-objects.mts | 6–6/6; 3–3/3; 2–2/3 | 4–4/6; 2–2/3; 3–3/3 | 4–4/6; 2–2/3; 3–3/3 | 6–6/6; 3–3/3; 2–2/3 |
| world-places.mts | 22–22/31; 3–3/10; 6–6/15 | 0–0/31; 0–0/10; 0–0/15 | 0–0/31; 0–0/10; 0–0/15 | 0–0/31; 0–0/10; 0–0/15 |
| world-preferences.mts | 16–16/20; 3–3/10; 5–5/16 | 12–12/20; 1–1/10; 10–10/16 | 11–11/20; 1–1/10; 10–10/16 | 0–0/20; 0–0/10; 0–0/16 |
| world-system-views.mts | 5–5/9; 0–0/1; 1–1/2 | 6–6/9; 0–0/1; 2–2/2 | 6–6/9; 0–0/1; 2–2/2 | 3–3/9; 0–0/1; 0–0/2 |
| world-viewport.mts | 0–0/14; 0–0/5; 0–0/6 | 8–8/14; 4–4/5; 2–2/6 | 8–8/14; 3–3/5; 2–2/6 | 0–0/14; 0–0/5; 0–0/6 |
| zoom-carry.mts | 12–12/27; 2–2/10; 3–3/6 | 1–1/27; 0–0/10; 0–0/6 | 1–1/27; 0–0/10; 0–0/6 | 0–0/27; 0–0/10; 0–0/6 |
| zoom-scope.mts | 47–47/47; 48–48/51; 10–10/10 | 12–12/47; 6–6/51; 2–2/10 | 10–10/47; 6–6/51; 2–2/10 | 8–8/47; 0–0/51; 0–0/10 |

## Per-file minification comparison

The same Earth/Mars visit list was used for both builds. Cells give browser hit
counts, `minified → unminified`, on the same source denominators. These are the
first runs; the preceding table records five-run ranges and the sole varying unit.
| File | Lines minified → unminified | Branches minified → unminified | Functions minified → unminified |
| --- | --- | --- | --- |
| application-world-context.mts | 53 → 55 | 8 → 9 | 8 → 8 |
| application-world-frames.mts | 23 → 27 | 17 → 17 | 9 → 9 |
| application-world-resources.mts | 97 → 98 | 33 → 34 | 44 → 44 |
| application-world-types.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| application-world-visibility.mts | 51 → 54 | 29 → 30 | 30 → 30 |
| arrival-billboard.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| asset-origin.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| built-pages.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| catalogue-moon-labels.mts | 66 → 67 | 11 → 11 | 20 → 20 |
| chart-pixel-alignment.mts | 3 → 3 | 1 → 1 | 2 → 2 |
| context-availability.mts | 1 → 1 | 0 → 0 | 0 → 0 |
| context-datasets.mts | 1 → 1 | 0 → 0 | 0 → 0 |
| dataset-content.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| dataset-context.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| dataset-picker.mts | 14 → 14 | 3 → 3 | 4 → 4 |
| dataset-response.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| dataset-url.mts | 5 → 5 | 1 → 1 | 2 → 2 |
| default-width-share.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| destination-browser.mts | 20 → 24 | 8 → 8 | 3 → 3 |
| diagnostic-recorder.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| diagnostics-policy.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| dot-catalogue-data.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| dot-catalogues.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| error-report.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| exploration-catalog.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| feature-browser.mts | 9 → 10 | 0 → 0 | 3 → 3 |
| first-view-transport.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| hosted-banks.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| import-queue.mts | 10 → 10 | 1 → 1 | 1 → 1 |
| in-flight-loader.mts | 3 → 3 | 0 → 0 | 2 → 1 |
| information-card.mts | 37 → 39 | 4 → 4 | 12 → 12 |
| initial-scene.mts | 2 → 2 | 1 → 1 | 1 → 1 |
| initial-shell-context.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| inside-view.mts | 14 → 16 | 14 → 16 | 6 → 6 |
| layout-sections.mts | 8 → 8 | 2 → 2 | 1 → 1 |
| learn-more.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| moon-orbit-policy.mts | 5 → 6 | 1 → 1 | 2 → 2 |
| narrow-layout.mts | 1 → 1 | 0 → 0 | 0 → 0 |
| native-input.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| native-view-forms.mts | 5 → 5 | 0 → 0 | 1 → 1 |
| next-frame.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-adapter.mts | 9 → 9 | 1 → 1 | 1 → 1 |
| object-browser.mts | 66 → 71 | 8 → 9 | 4 → 4 |
| object-children.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-classification-label.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-directory.mts | 41 → 43 | 10 → 10 | 16 → 16 |
| object-entries.mts | 19 → 20 | 2 → 2 | 2 → 2 |
| object-entry.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-page-contract.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-page-data.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-shell-types.ts | 0 → 0 | 0 → 0 | 0 → 0 |
| object-systems.mts | 30 → 31 | 10 → 11 | 7 → 7 |
| object-text.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| objects.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| orbit-root.mts | 5 → 5 | 2 → 2 | 1 → 1 |
| overview-selection.mts | 33 → 37 | 12 → 13 | 12 → 12 |
| packaged-object-runtime.mts | 15 → 15 | 4 → 5 | 5 → 5 |
| planetary-system-members.mts | 12 → 12 | 7 → 7 | 6 → 6 |
| prepare-body-moons.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| prepared-arrival.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| prepared-descriptor.mts | 7 → 7 | 0 → 0 | 1 → 1 |
| prepared-object-path.mts | 5 → 5 | 1 → 1 | 2 → 2 |
| prepared-panel-content.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| prepared-scene-ownership.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| prepared-world-navigation.mts | 68 → 75 | 30 → 31 | 16 → 16 |
| prepared-world-presentation.mts | 24 → 24 | 20 → 20 | 9 → 9 |
| root-object.mts | 3 → 3 | 2 → 2 | 1 → 1 |
| runtime-policy.mts | 32 → 39 | 14 → 16 | 5 → 5 |
| satellite-selection.mts | 9 → 11 | 3 → 3 | 2 → 2 |
| satellite-systems.mts | 24 → 24 | 11 → 11 | 10 → 10 |
| scientific-chart-order.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| selection-presentation.mts | 16 → 21 | 15 → 16 | 7 → 7 |
| seo-trail.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| seo.mts | 7 → 9 | 3 → 3 | 2 → 2 |
| shared-imports.mts | 3 → 3 | 0 → 0 | 0 → 0 |
| showcase.mts | 10 → 10 | 0 → 0 | 1 → 1 |
| sidebar-thumbnails.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| social-images.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| source-documentation.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| source-icons.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| source-link.mts | 8 → 12 | 10 → 10 | 4 → 4 |
| startup-billboard.mts | 20 → 17 | 4 → 4 | 3 → 3 |
| startup-boot.mts | 9 → 11 | 2 → 2 | 5 → 5 |
| startup-cover.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| startup-requests.mts | 10 → 12 | 1 → 2 | 3 → 3 |
| startup-world.mts | 24 → 25 | 20 → 20 | 9 → 9 |
| stellar-extents.mts | 6 → 6 | 4 → 4 | 2 → 2 |
| system-card.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| system-framing-radii.mts | 19 → 21 | 16 → 18 | 4 → 4 |
| system-framing.mts | 82 → 88 | 50 → 53 | 24 → 24 |
| tab-panels.mts | 16 → 18 | 2 → 3 | 4 → 4 |
| view-readout.mts | 61 → 79 | 34 → 38 | 17 → 17 |
| view-url-runtime.mts | 36 → 48 | 12 → 15 | 8 → 8 |
| volume-presentation.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| web-analytics.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| world-approach.mts | 27 → 32 | 13 → 16 | 5 → 5 |
| world-camera.mts | 2 → 2 | 2 → 2 | 0 → 0 |
| world-context-plan.mts | 47 → 50 | 13 → 15 | 14 → 14 |
| world-objects.mts | 4 → 4 | 2 → 2 | 3 → 3 |
| world-places.mts | 0 → 0 | 0 → 0 | 0 → 0 |
| world-preferences.mts | 11 → 12 | 1 → 1 | 10 → 10 |
| world-system-views.mts | 6 → 6 | 0 → 0 | 2 → 2 |
| world-viewport.mts | 8 → 8 | 3 → 4 | 2 → 2 |
| zoom-carry.mts | 1 → 1 | 0 → 0 | 0 → 0 |
| zoom-scope.mts | 10 → 12 | 6 → 6 | 2 → 2 |
