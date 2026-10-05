# Server answers safety net

L2 records server behavior through the real preview middleware, the built Netlify functions and their actual edge
router, and the built Cloudflare Worker. It compares status, headers, response bodies, deployment facts and packaged
file reads. A recording becomes a baseline only after its sanity check passes. Browser bundle contents belong to L3.

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

Netlify page requests pass through the imported edge function. Its pass-throughs use the static adapter, rather
than the search function. Each function runs in its own temporary package containing only its bundle and the
files expanded from its global/per-function `included_files`. Globs support `*`, `**` and `!` exclusions. Runtime
reads through file APIs, directory/stat/open operations, streams and module loading are traced. Reads outside the
real isolated root fail; missing packaged data fails during replay. File reads are part of `closure.json`.

`index.json` records the configured functions directory, edge route, worker main, assets binding/directory,
`run_worker_first`, `html_handling`, and immutable cache rules from both `netlify.toml` and `dist/_headers`.
Changes to these facts appear in the diff. Temporary packages are removed when a child exits or disconnects.

Cloudflare warms the find catalogue and lazy page modules before representative requests. Any child diagnostic
containing `page-handler-fallback` rejects the recording. Rewritten search answers must retain their submitted-search
marker and robots directive and discard stale static validators/length/encoding headers. A separate test injects
an actual Worker handler failure and verifies the fallback and its log; fallback is never accepted as a healthy baseline.

## Normalizations and storage

| Dimension | Recorded rule and reason |
| --- | --- |
| HTML bundle URLs | Replace `/_astro/<name>.<hash>.<ext>` with `/_astro/<name>.HASH.<ext>`. Bundle content and filenames belong to L3. The script probe selects the stable `ObjectLayout` name, never the first sorted file. |
| Version | Only the brand link's displayed `v<major>.<minor>` and GitHub label become `vPINNED`. The commit count changes this text even when the tracked tree is identical. Other version text remains exact. |
| HTML static bytes | Store canonical static-page length and md5 plus the answer's static-remainder length and md5. Assert equality outside `search-shell` and `prepared-scene`, the regions the handler owns. A changed byte in either the static file or answer remains detectable. |
| HTML rewritten regions | Unchanged regions refer to the static file. Changed regions retain their entire canonical contents, losslessly gzip-compressed as base64 in JSON. No truncation or sampling. |
| JSON | Recursively sort object keys; preserve values and array order. Large values are losslessly gzip-compressed on disk and parsed again when checking/diffing. |
| Binary | Byte length, first 64 bytes and md5. The digest is a change detector, not a security claim. |
| Script probe | Record presence and the range's returned length; omit bundle bytes and normalize the total bundle length in Content-Range. Status, range bounds and headers still detect server changes. L3 owns bundle bytes. |
| ETag | Presence plus weak/strong kind. Opaque values can change between recordings of the same build because preview tags include filesystem timestamps. The conditional request uses the observed original value. |
| Content-Length | Absent, zero or nonzero; bodies retain exact bytes or lengths except the explicitly L3-owned script. |
| Origins | Replace the preview's ephemeral loopback origin in header values with `https://answers.invalid`. |

All response headers are retained except this deny list:

- `date`, `last-modified`: server clock and filesystem timestamp; the conditional probe uses the original timestamp.
- `server`, `connection`, `keep-alive`: server implementation and socket lifetime.
- `host`, `x-nf-request-id`, `cf-ray`, `x-served-by`, `via`: host/routing/request identifiers.
- `age`, `cf-cache-status`, `x-cache`, `x-cache-hits`, `server-timing`: cache residency and elapsed execution time.

Security headers, cookies, robots directives and newly added headers remain visible. Static stand-ins send
content type, length, strong ETag and Last-Modified so handler cleanup is exercised. Cache policy uses the immutable
`/_astro/*` rules in `netlify.toml` and `dist/_headers`; ordinary files use revalidation. Wrangler supplies static
asset handling facts. Every request explicitly asks for identity encoding, so compressed provider transport is not
simulated and no Content-Encoding is invented. These are deterministic adapters, not measurements of hosted CDN headers.

Length-plus-digest comparison has a theoretical collision limit. The complete rewritten regions are losslessly
retained; static bytes remain available in the build being compared. A one-byte static-page mutation and an actual
bundled handler rewrite are qualification gates.

## Build comparison job

Run the same runner against clean base/head builds. The portable clone helper restores ignored prepared inputs,
compiled packages and dependencies from the provisioned checkout using copy-on-write where supported, falling back
to ordinary copies. It performs no download, preparation, publication or asset-store write. Copies are new siblings
of the restored checkout and are deleted afterward. The runner builds Astro, Netlify functions and the Cloudflare
bundle, records/checks all three targets, and collects all target exit codes. It does not stop diffing after the first
changed target. The integration layer owns the workflow; L2 creates none.

The following complete job qualifies two clean builds of the same revision, then an already-created empty commit
with a different commit count, and finally an asset-origin build. The orchestrator supplies that empty commit; the
runner never creates commits. The second invocation compares an ordinary base/head pair.

```sh
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
repo=$(git rev-parse --show-toplevel)
cd "$repo"
base_ref=origin/main
head_ref=HEAD
version_ref=server-answers-empty-commit
pnpm install --frozen-lockfile
node .github/scripts/server-answers/build-flow.mts --revision "$head_ref" --head-ref "$version_ref" --asset-origin --out output/server-answers-qualification-builds
node .github/scripts/server-answers/build-flow.mts --revision "$base_ref" --compare-ref "$head_ref" --out output/server-answers-base-head
```

The restored inputs and their owning compiled packages must already exist in the provisioned checkout. Do not
use a prepared build from another revision as proof of a clean source build. `ASSET_ORIGIN` is a build-time setting:
`site/asset-origin.mts` rewrites HTML, prepared JSON and CSS addresses; dataset responses consume that encoded origin.
Setting only the function process environment would not exercise production. The variant rebuilds Astro with
`https://assets.invalid`; stand-ins resolve published URLs through each object's inventory to restored public files.
The variant's addresses intentionally differ from the same-origin baseline, so it is checked separately.

## Qualification and mutations

This complete sequence starts with a restored checkout, builds only the needed outputs, qualifies current output,
and then replays source-level preview mutations in a disposable sibling copy. The output-only qualification restores
all modified bytes in `finally`; source mutations also restore their inputs. Use fresh output directories each time.

```sh
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
repo=$(git rev-parse --show-toplevel)
cd "$repo"
pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build
node site/build/bundle-netlify-functions.mts
node site/build/bundle-cloudflare-worker.mts
node .github/scripts/server-answers/qualify.mts --out output/server-answers-qualification
copy="$repo-server-answers-mutations"
node .github/scripts/server-answers/clone-restore.mts --source "$repo" --destination "$copy" --revision HEAD
node --input-type=module - "$repo" "$copy" <<'JS'
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
const [source, destination] = process.argv.slice(2);
await cp(resolve(source, 'dist'), resolve(destination, 'dist'), { recursive: true });
await cp(resolve(source, '.github/scripts/server-answers'), resolve(destination, '.github/scripts/server-answers'), { recursive: true });
JS
node .github/scripts/server-answers/mutate.mts --copy "$copy" --target netlify
node .github/scripts/server-answers/mutate.mts --copy "$copy" --target preview
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
| Missing-object find status | Status diff 1. |
| Missing-object find text | JSON body diff 1. |
| Remove packaged world-index | Record fails, or checker rejects missing closure; never a passing baseline. |
| Remove `q` rewrite trigger | Real edge test/preview diff fails; submitted-marker sanity fails. |
| Change prepared Range status | Real middleware probe and preview sanity fail; static range behavior remains separate. |
| Worker handler failure | Real fallback test verifies fallback log; recorder rejects such a diagnostic. |

## Cost and limits

Measurements dated **2026-10-05**, from checkout `6e270e54e4eaf267e7ecdb51738536f1b6d3b265` with its restored build.
The same-origin recordings use restored outputs and do not establish that those outputs were produced from this
commit. The asset-origin variant is an Astro source build of this checkout with restored inputs. Clean-clone
measurements are still required before claiming build-to-build qualification.

| Stage | Wall time | Result / storage |
| --- | --- | --- |
| Preview recording | 22.22–27.90 s | 351 answers; 18,038,230 bytes (previous full format: 225,416,746). |
| Netlify recording | 42.51–52.89 s | 349 answers; 18,164,830 bytes (previous full format: 215,480,764). |
| Cloudflare recording | 14.67–14.80 s | 346 answers; 18,115,879 bytes (previous full format: 224,971,893). |
| Sanity / comparison per target | 0.36–0.77 / 0.40–0.53 s | All three sane; semantic diff 0 and byte-identical repeat directories. |
| Six output mutations | 15.58–33.94 s each recording | Static byte, rewrite, header, status and body: diff 1; missing package file: record 2; restored diff 0. |
| Clean clone/build comparison and version variant | Not measured | Required evidence still missing. |
| Asset-origin Astro / Cloudflare bundle | 363.02 / 5.40 s | Build exits 0; emitted Earth HTML/JSON verified. |
| Asset-origin Netlify record / sanity | 53.72 / 1.02 s | 349 answers, exits 0/0; inventory-backed published URLs served locally. |
| Asset-origin Cloudflare record / sanity | 25.59 / 0.88 s | 346 answers, exits 0/0; original outputs restored afterward. |

A four-build qualification job is projected at about 30–35 minutes, plus dependency/cache and clone restoration,
using the measured six-minute asset-origin build and recording costs. This is an estimate from one build variant,
not a measured clean CI run; Netlify bundling and clone restoration remain untimed. Each build stage has a
15-minute termination limit. Retain failing local evidence; passing recordings may be deleted after comparison.

L2 cannot see:

- Hosted Netlify/Cloudflare edge execution, CDN configuration enforcement, compression or provider HEAD body removal.
- Browser behavior or bundle contents (L1 and L3), report log text, or query/object combinations outside the catalogue.
- Dormant filesystem branches not triggered during replay; the isolated package still prevents undeclared file access.
- Live published-origin availability and provider CORS; the offline asset-origin variant covers address resolution
  and function responses using restored inventory files.
- A positive deployed place lookup when the current feature index contains no places; its successful lookup branch remains outside this catalogue. Dione feature search is covered, but its feature-page selection currently lacks prepared
  geometry and fails; that unsupported page probe cannot be called a healthy baseline.
- Arbitrary cryptographic digest collisions in compact static/binary fingerprints.
