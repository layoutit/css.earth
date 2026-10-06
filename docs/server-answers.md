# Server answers safety net

L2 records server behavior through the real preview middleware and the built Cloudflare Worker. It compares status,
headers, response bodies and deployment facts. A recording becomes a baseline only after its sanity check passes. Browser bundle contents belong to L3.

The [runner](../.github/scripts/server-answers/record.mts), [checker](../.github/scripts/server-answers/check.mts),
[differ](../.github/scripts/server-answers/diff.mts) and their tests live together. The package commands are
`pnpm server-answers:record`, `pnpm server-answers:check` and `pnpm server-answers:diff`; arguments follow the command.
Record exits 0 on success or 2 on tool/handler failure. Check exits 0 for a sane baseline or 1 for rejection.
Diff exits 0 for equality, 1 for differences or 2 for malformed input. Its default summary names every changed
request and dimension; `--full` includes values, and `--json <file>` saves the complete report.

## What is recorded

The catalogue derives page titles, datasets, scene identities and saved views from the built registry and HTML.
Fifteen capability representatives cover static pages, searches, empty and oversized queries, dataset selection,
settings, saved views, view/category contexts and combinations. Additional requests cover:

- Find errors, numeric place lookup, positive offset, illustrations, Earth and Dione features, methods and CORS Origin.
- Search errors for malformed features, unavailable datasets, invalid settings, duplicate views and unknown objects.
- Query pages without a trailing slash, HEAD and POST with query, root search and the Worker's `www.` redirect.
- Navigation, first-view data, prepared files, robots, sitemap, missing paths, static ranges and conditional requests.
- Report responses; the report's diagnostic text is outside the comparison.

The Worker runs as bundled; its assets binding and the files it reads from the built site go through the static
adapter. `index.json` records the assets binding/directory (from the repository root), `run_worker_first`,
`html_handling`, all header rules and the immutable cache rule from `dist/_headers`. Changes to these facts appear in the
diff. Where the checkout keeps the Worker script is layout, not a fact: moving it changes no recording.

Cloudflare warms the find catalogue and lazy page modules before representative requests. Any child diagnostic
containing `page-handler-fallback` rejects the recording. Rewritten search answers must retain their submitted-search
marker and robots directive and discard stale static validators/length/encoding headers. A separate test injects
an actual Worker handler failure and verifies the fallback and its log; fallback is never accepted as a healthy baseline.

## Normalizations and storage

| Dimension | Recorded rule and reason |
| --- | --- |
| HTML bundle URLs | Replace hashes with the extension + name + byte-size class, `/_astro/<name>.SIZE<bytes>.<ext>`. This distinguishes same-name chunks of different sizes and wrong references; same-name, same-size chunks share a class. Referenced files must exist before normalization. Bundle contents belong to L3; byte-size class changes remain visible. The script probe selects the stable `ObjectLayout` name, never the first sorted file. |
| Version | Only the brand link's displayed `v<major>.<minor>` and GitHub label become `vPINNED`. The commit count changes this text even when the tracked tree is identical. Other version text remains exact. |
| Source-link commit id | In `https://github.com/layoutit/cssEarth/blob/<40 lowercase hex>/`, replace only the commit id with `0000000000000000000000000000000000000000` in HTML, JSON values, text and headers. It identifies build provenance, not server behavior. The same-length placeholder preserves offsets and lengths; the path and everything else remain detectable. Both static pages and answer remainders are normalized before computing stored lengths and md5. |
| HTML static bytes | Store canonical static-page length and md5 plus the answer's static-remainder length and md5. Assert equality outside `search-shell` and `prepared-scene`, the regions the handler owns. A changed byte in either the static file or answer remains detectable. |
| HTML rewritten regions | Unchanged regions refer to the static file. Changed regions retain their entire canonical contents, losslessly gzip-compressed as base64 in JSON. Decode before checking/diffing, so gzip metadata cannot cause differences. No truncation or sampling. |
| JSON | Recursively sort object keys; preserve values and array order. Large values are losslessly gzip-compressed on disk and parsed again when checking/diffing. |
| Binary | Byte length, first 64 bytes and md5. The digest is a change detector, not a security claim. |
| Script probe | Record presence and the range's returned length; omit bundle bytes and normalize the total bundle length in Content-Range. Status, range bounds and headers still detect server changes. L3 owns bundle bytes. |
| ETag | Presence plus weak/strong kind. Opaque values can change between recordings of the same build because preview tags include filesystem timestamps. The conditional request uses the observed original value. |
| Content-Length | Absent, zero or nonzero; bodies retain exact bytes or lengths except the explicitly L3-owned script. |
| Origins | Replace the preview's ephemeral loopback origin in header values with `https://answers.invalid`. |

All response headers are retained except this deny list:

- `date`: server clock. Last-Modified and Expires retain `present`, because their presence controls stale-header checks; conditional probes use the original timestamp.
- `server`, `connection`, `keep-alive`: server implementation and socket lifetime.
- `host`, `cf-ray`, `x-served-by`, `via`: host/routing/request identifiers.
- `age`, `cf-cache-status`, `x-cache`, `x-cache-hits`, `server-timing`: cache residency and elapsed execution time.

Security headers, cookies, robots directives and newly added headers remain visible. Static stand-ins send
content type, length, strong ETag, Last-Modified and Expires. Requests explicitly negotiate gzip; the stand-in
supplies Content-Encoding for compressible files while delivering decoded bytes, as `fetch` does. This exercises
rewritten-page cleanup. Every rule in `dist/_headers` applies in order.
Ordinary files use revalidation. Cloudflare bypasses the Worker on `run_worker_first` exclusions; its assets binding
redirects slashless directory pages for `auto-trailing-slash`. These adapters are not measurements of hosted CDN headers.

Length-plus-digest comparison has a theoretical collision limit. The complete rewritten regions are losslessly
retained; static bytes remain available in the build being compared. A one-byte static-page mutation and an actual
bundled handler rewrite are qualification gates.

## Build comparison job

The [site safety-net lane](build-comparison.md) runs L2 inside its existing
build-comparison job, after L3 compares the merge base and head. It reuses those
two production-shaped builds; it adds no Astro build, preparation or clone.

For each checkout it moves the comparison output back to `dist`, resolves and
runs only the Worker bundler from that revision’s scripts (an older revision
also runs the one bundler it has after Astro), then records and checks preview
and Cloudflare. The output returns to
its evidence directory afterward, including on recording failure. The Worker
bundler also stages place files and `_headers`. Each target is diffed base against head.
The trusted recording tools come from the merge base, with the comparison
lane’s explicit tool override and visible bootstrap exception.

The comparison builds use `ASSET_ORIGIN=https://earth-assets.lowpoly.cc`.
`record.mts --asset-origin <origin>` routes that origin through the host’s
inventory-backed static adapter, including preview middleware fetches. Its
default remains `https://assets.invalid` for standalone qualification. Other
network origins fail. The stage uses the already restored selected inputs and
rejects missing data; no full scene bank is downloaded for this stage.

Without a fresh declaration, L2 differences and recording/check failures are
notices with logs. With either `pure-move` or `semantic`, every server difference
and sanity failure fails the job. L3 output or layout permissions never allow
server changes. Counts, first differences and timings appear in the job summary
and `server-answers.json`; small diff summaries are uploaded, and differing
recording pairs are included only below a combined 40 MB budget. Missing files
do not fail artifact upload. L2 subprocesses share a five-minute limit.

## Standalone qualification flow

The standalone flow keeps its full offline deployment sequence for qualification,
repeat runs, version normalization and mutations. It is separate from the lane’s
post-build reuse stage. Both standalone builds use `ASSET_ORIGIN=https://assets.invalid`,
a production-origin address shape resolved offline by the recorder host.

The clone helper restores dependencies, downloaded `src/objects/*/prepared` inputs and public inputs. It excludes
compiled `packages/*/dist`, generated shell modules and generated features/shell outputs. Every clone runs
`CSSEARTH_SKIP_DECLARATIONS=1 pnpm build:packages` and `pnpm prepare:shell`, then its own offline deployment
sequence, including metadata preparation, share images, assembly and the Worker bundle. Download-only setup is skipped;
missing inputs fail with network disabled. Environment image restoration is offline and remains in the sequence.
`prepare:typecheck` is unnecessary here: deployment regenerates the feature and facility catalogues it supplies.

`site/public/scenes` is a read-only shared symlink, not a copied tree. Metadata preparation, share images, feature
bundling and the published-origin adapter read it. It is detached while Astro copies `site/public/`, then restored for
bundling/recording; a production-shaped Astro build uses the manifest and emits no scene copy. Build subprocesses reject writes into shared scenes.
Each clone is deleted immediately after its recording/checks; only one clone exists at a time.

Build steps and preview entry come from each revision's `package.json`; the Worker output comes from the wrangler
configuration its `deploy:cloudflare-preview` script names with `--config`, whose `main` and `assets.directory` are read
from that file's folder. The checker imports that clone's page router (`site/server/search-route.mts`) too. Unsupported
script/config shapes fail explicitly. No entry is imported from the other revision.

Use **Node 24** for CI qualification. Start from a provisioned checkout with its inventoried data restored.
The preview baseline requires `src/objects/earth/prepared/runtime.json`; otherwise its prepared probe returns 404.
A standalone base/head qualification is:

```sh
node --version # must be 24.x
pnpm install --frozen-lockfile
node .github/scripts/server-answers/build-flow.mts --revision origin/main --compare-ref HEAD --out output/server-answers-base-head
```

Same-revision repeat and empty-commit version qualification belong to the nightly job. Create the empty commit
in a disposable checkout; the runner never creates commits:

```sh
node --version # must be 24.x
pnpm install --frozen-lockfile
qualification_ref=$(git rev-parse HEAD)
git commit --allow-empty -m "Qualify server answer version normalization"
node .github/scripts/server-answers/build-flow.mts --revision "$qualification_ref" --head-ref HEAD --qualification --out output/server-answers-nightly
```

## Qualification and mutations

Run output mutations against a freshly built production-shaped checkout. Source/package mutations require a
clean rebuilt disposable revision, not copied compiled outputs. The build runner is the complete base/head and
nightly recipe above. The output mutation runner restores changed bytes in `finally`:

```sh
node --version # must be 24.x
pnpm install --frozen-lockfile
repo=$(git rev-parse --show-toplevel)
copy="$repo-server-answers-qualification"
node .github/scripts/server-answers/clone-restore.mts --source "$repo" --destination "$copy" --revision HEAD
node .github/scripts/server-answers/build-revision.mts "$copy"
(cd "$copy" && node "$repo/.github/scripts/server-answers/qualify.mts" --out "$repo/output/server-answers-qualification")
node --input-type=module - "$copy" <<'JS'
import { rm } from 'node:fs/promises';
await rm(process.argv[2], { recursive: true, force: true });
JS
```

| Mutation | Required rejection |
| --- | --- |
| One byte of static Earth HTML | Body diff 1 despite compact recording. |
| Actual bundled search-shell rewrite | Body diff 1; compressed full region changes. |
| Search cache-control | Header diff 1. |
| Retain Last-Modified, Expires or Content-Encoding on a rewritten page | Sanity rejects each stale header; unit mutations keep each observable. |
| Change package-emitted section markup | Rebuild clone packages and page outputs; diff 1. |
| Missing browser chunk / wrong same-name chunk size class | Recording fails / body diff 1. |
| Missing-object find status | Status diff 1. |
| Missing-object find text | JSON body diff 1. |
| Remove world-index before bundling the Worker | The Worker bundle fails; never a passing baseline. |
| Remove `q` rewrite trigger | Real page-route test/preview diff fails; submitted-marker sanity fails. |
| Change prepared Range status | Real middleware probe and preview sanity fail; static range behavior remains separate. |
| Worker handler failure | Real fallback test verifies fallback log; recorder rejects such a diagnostic. |

## Cost and limits

Measurements dated **2026-10-05**, clean builds of commit **47e83c97cf4133a1d185ff5c597c0185471f3671**,
on this macOS machine, when Netlify was still a recorded target. Same-revision repeat and distinct empty-commit version builds each gave **diff 0 on all
three targets**. Those comparisons used the plain asset shape; a separate production-origin build passed sanity
on Netlify and Cloudflare. They do not qualify the updated package rebuild/production-shaped comparison flow.
Linux and Node 24 clean comparisons have not been run.

| Measured stage | Base | Repeat | Version | Production-origin variant |
| --- | ---: | ---: | ---: | ---: |
| Clone/restore | 146.15 s | 180.22 s | 184.19 s | 126.61 s |
| Astro | 460.29 s | 292.77 s | 391.84 s | 357.83 s |
| Netlify bundle | 3.12 s | 2.06 s | 3.56 s | 2.40 s |
| Cloudflare bundle | 4.80 s | 2.72 s | 5.18 s | 4.18 s |
| Preview record | 21.90 s | 20.88 s | 22.52 s | Not recorded |
| Netlify record | 63.34 s | 35.08 s | 39.13 s | 48.48 s |
| Cloudflare record | 17.57 s | 17.03 s | 18.33 s | 21.18 s |
| Sanity per target | 0.50–0.89 s | 0.43–0.46 s | 0.51–0.68 s | 0.47–0.61 s |
| Comparison per target | — | 0.44–0.51 s; diff 0 | 0.45–0.53 s; diff 0 | Sanity only |

The measured four-build run took **2,502.27 s (41.70 minutes)**.

The pull-request flow (the base `origin/main` against this branch, production-origin shape, packages and shell
modules rebuilt in each clone, each clone deleted after its recording) was measured on the same machine with commit
**5fb66421** as the head: **935 s** in total, a built clone **12.5 GB** allocated (restored: 8.3 to 8.6 GB, shared
scenes not counted), and **diff 0 on preview, Netlify and Cloudflare**. A change inside `packages/renderer` made in a
rebuilt clone differs on all three targets (209 to 215 recordings) and restores to diff 0. No hosted-runner timing is
measured.

| Budget | Local measurement / basis | Hosted-runner planning estimate |
| --- | --- | --- |
| Safety-net L2 addition | Reuses L3 base + head; no further builds | About 3–4 minutes; five-minute subprocess cap. Hosted reuse remains unmeasured. |
| Standalone base/head qualification | Exactly base + head, sequential clone lifetime | 20–35 minutes including package regeneration. |
| Nightly qualification | Base + repeat + version | 30–55 minutes; no additional origin-only build. |
| Shared inputs | Review measured roughly 9.1 GB public scenes + 3.6 GB prepared; no clone `du` evidence retained | Provisioned once. Scenes are shared, not copied into clones or Astro output. |
| Clone/output peak | Updated flow unmeasured; one clone's prepared data, dependencies, compiled packages and scene-free dist | Reserve 15 GB beyond provisioned inputs; verify allocated and apparent `du` on Linux. |

These disk/time estimates are capacity planning, not Linux qualification. Each subprocess stage has a 15-minute
termination limit. Keep recording and timing evidence outside disposable clones. Built-page `static.*` differences
are labelled **built output** in the summary: they may reflect inline styles/scripts as well as server changes.
Deleting `site/public/features/index.json` does not affect the Cloudflare target: the Worker reads its bundled files from `dist`.

L2 cannot see:

- Hosted Cloudflare edge execution, CDN configuration enforcement, compression or provider HEAD body removal.
- Browser behavior or bundle contents (L1 and L3), report log text, or query/object combinations outside the catalogue.
- Dormant code branches not triggered during replay.
- Live published-origin availability and provider CORS; the offline asset-origin variant covers address resolution
  and handler responses using restored inventory files.
- A positive deployed place lookup when the current feature index contains no places; its successful lookup branch remains outside this catalogue. Dione feature search is covered, but its feature-page selection currently lacks prepared
  geometry and fails; that unsupported page probe cannot be called a healthy baseline.
- Arbitrary cryptographic digest collisions in compact static/binary fingerprints.
