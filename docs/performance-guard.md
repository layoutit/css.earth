# Counted performance guard: part A

A refactor may keep performance the same or improve it. Every counted measure must be less than or equal to the merge base. One byte or one request more fails, even when another measure improves and even inside an allowed output change. Raw, gzip and Brotli sizes are independently strict, with no compressed-size slack. A chunk movement that makes any compressed size rise fails: the graph-build proof improves raw size by 57 B but increases gzip by 55 B and Brotli by 145 B, so it fails. An S3 change that moves code between chunks must keep the chunk layout or show compressed sizes at or below baseline. This guard measures emitted builds; it does not change the application or wire a CI stage.

```text
merge-base build → measures ─┐
                            ├→ compare → pass or named findings
candidate build  → measures ─┘
```

Improvements pass by default (`--accept-improvements` explicitly requests the same behavior). Merging an improvement makes it part of the next merge base, so the baseline ratchets automatically. There is no committed baseline and no command that overwrites one.

## What it counts

- HTML document bytes: raw, gzip level 6 and Brotli quality 4; inline scripts and styles: counts and raw UTF-8 bytes. JSON data scripts and no-script declarations remain visible in the report.
- Declared preload, modulepreload, prefetch, preconnect and DNS-prefetch links: counts by relation, hrefs, `as`, fetch priority, image/font hint counts. Stylesheet links and bytes, module/classic script counts, async/defer flags and entry order are retained.
- Static module closure: distinct chunks, raw/gzip/Brotli bytes, each chunk's bytes and the longest simple static path, measured in chunks including the entry. A cycle does not count a chunk twice on one path.
- Reachable dynamic import targets: distinct target count, each target's bytes, total target bytes, the complete static/dynamic closure, and source order of literal `import()` expressions for each importing chunk. Comments and string contents cannot create imports. Runtime-computed import expressions have a separate count and ordered record; their target bytes require browser evidence.
- Head startup requests: the emitted bootstrap's validated URL arguments, additional literal fetches, methods (GET by default; literal method options are validated), document order and each transport's raw/gzip/Brotli bytes. System routes omit the body transport from the head when they differ from the bootstrap's scene route; its declared later load is reported separately. Embedded summary data contributes bytes but no network request. Requests started by the bootstrap are parallel, so they count as one request stage.
- The declared startup import queue: metadata identifies the emitted loader targets and the startup functions that enqueue them. Its sequence is recorded separately from lexical import order. The dependency-round count includes the entry's static path and the queue's fresh static paths, excluding dependencies already reached by earlier loads.
- Global JavaScript chunk and CSS counts/bytes, JavaScript gzip/Brotli bytes and each emitted object/world JSON transport's raw size. Per-file transport counts prevent improvements elsewhere from hiding growth. Routes also carry their startup transport sizes and reachable chunk sizes.

These are deterministic counts and file lengths, not elapsed time. Compression uses fixed settings on the same Node/zlib version for both builds; compare builds with the same toolchain. Data URL payloads are measured separately from their already-counted HTML representation. Maps introduced for comparison evidence are not runtime JavaScript chunks.

The dependency-round measure is a declared graph-depth model, **not observed network round trips**. The first body runtime overlaps the head's document requests; the router waits for the startup world, then the registry and application-world queue. Conditional execution, worker creation, cache reuse, transport adoption and later requests need part B. Unsupported head request expressions or startup schedules fail analysis rather than silently returning zero. Runtime-computed imports are explicitly reported, not claimed to have known target sizes.

## Comparison rules

Every numeric leaf is compared independently, including individual emitted transports and chunk sizes. An absent numeric key means zero: deleting a resource improves its measure; adding a resource increases it. Equality passes. Decreases are listed as `IMPROVEMENT`; increases are listed as `FAILURE`, with the route, measure and both numbers. Numeric findings have kind `increase`; only failures contribute to the failure counts by kind.

An ordered sequence may stay identical or become a strict ordered subsequence: remove one or more elements without adding, substituting or reordering the retained elements. A shorter reordered sequence fails. Duplicate occurrences are matched separately. This applies to startup URLs, entry scripts, queued loaders, computed-import sites and each chunk's lazy imports. A reduced chain count does not excuse a reordered sequence. Sequence findings have kind `order`, so reorders are not reported as byte or count increases.

Declarations are compared as exact canonical records with duplicate occurrences retained. Hrefs, link relations, `as`, fetch priority and script async/defer flags cannot change or be added. Only pure removal of whole declarations is an improvement; dropping an attribute from a retained declaration fails. Declaration findings have kind `declaration`.

Added and removed routes are reported and fail closed, because a missing comparison counterpart cannot establish the guarantee. Removed routes also carry a `removed-route` failure finding. Changing coverage requires an explicit decision outside this comparator. Chunk identities use their metadata facade module basename or stable chunk name, rather than content-dependent emitted filenames. Duplicate names are disambiguated by module ownership; ambiguous identities fail analysis. An identity change is conservative: a new positive measure fails until reviewed.

## Run on two existing builds

The two builds must already exist, with comparison metadata beside them. No build command is part of the guard. From the repository root, using the project's Node version:

```sh
node .github/scripts/performance/measure.mts --dist "$BASE_BUILD/dist" --metadata "$BASE_BUILD/metadata" --out output/performance-base --summary output/performance-base.md
node .github/scripts/performance/measure.mts --dist "$HEAD_BUILD/dist" --metadata "$HEAD_BUILD/metadata" --out output/performance-head --summary output/performance-head.md
node .github/scripts/performance/compare-measures.mts --base output/performance-base --head output/performance-head --json output/performance-comparison.json --summary output/performance-comparison.md
```

Set `BASE_BUILD` and `HEAD_BUILD` to the retained merge-base and candidate build directories. Metadata is JSON from the [build comparison tooling](build-comparison.md); this guard consumes its client and worker records and cross-checks literal static and dynamic edges against the actual emitted JavaScript. The tooling stays inside `.github/scripts/` and imports no application or lab code.

The default is the thirteen S0 capability representatives plus `/earth/` and `/` (fifteen routes), from [routes.json](../.github/scripts/performance/routes.json). System representatives retain their system route ids; they are not replaced with the scene ids. Every selected page must exist. `--routes /,/earth/` selects an explicit comma-separated set; `--routes representatives` selects the default. The shipped defaults and offline proofs use the same route set, including both Earth pages.

`measure` writes `measures.json`, with sorted object keys and stable route ordering. Counts, ordered sequences and exact declarations are all compared independently. `compare` returns JSON with `pass`, `findings`, `addedRoutes` and `removedRoutes`. Findings carry `increase`, `order`, `declaration` or `removed-route` kinds; Markdown summaries report failure counts per kind and can go directly into a job summary. Exit 0 means equal or improved, exit 1 means a regression or coverage change. Invalid inputs also exit unsuccessfully and are not successful comparisons.

## In the comparison lane

The [build comparison lane](build-comparison.md) runs the guard on the two builds it already made, after the build comparison and before the server answers (`.github/scripts/build-compare/performance-stage.mts`): it measures `<out>/base` and `<out>/head` (their `dist/` and `metadata/`), compares them, writes `performance.json` and the Markdown comparison to the job summary, and uploads both with the lane artifacts. The tools come from the merge base, like the other lane tools, except for the pull request that introduces them.

- A declared refactor (`.github/site-refactor.json`, every plan-7 pull request) is fully strict: any increase fails the lane, and a stage that cannot run fails closed, since a guard that silently skips guards nothing.
- An ordinary feature pull request only reports: the increases appear in the job summary and the lane does not fail, because a new feature legitimately adds bytes.
- The label `performance-increase-approved` applies to a declared refactor only and only the owner may set it: the lane still reports every increase and then passes. Nothing else disables the rule.
- A decrease is an improvement and needs nothing: the next pull request compares against the merged result.

## Existing contracts and the build boundary

All [performance notes](performance/README.md) were reviewed for this boundary:

| Contract | Part A evidence | Needs the browser |
| --- | --- | --- |
| Billboard-first startup | HTML bytes, omitted texture preloads, object versus first-view transport declarations | Eligibility, reveal, texture demand, adoption and camera acknowledgement |
| Startup gate | Head documents, bank declarations and lazy graph sizes | Actual deferral until detail-ready/idle and subsequent bank order |
| World context by system | Summary embedding, anywhere/system transport sizes and startup URL order | Approach, category demand, batching and retained joining |
| Disabled module preloads and lazy import queue | Declared modulepreload count, emitted import edges/order, metadata-derived queue | Safari's duplicate fetch/evaluation behavior and conditional execution |
| Inlined page CSS | Inline style bytes, stylesheet counts and bytes | Paint improvement and fragment stylesheet reuse |
| CSS graphics techniques | Emitted code/transport size only | Sparse publication, worker work, clone cost, layout and paint |
| Opacity publication and opacity dirty publication | Emitted code size only | Changed-opacity writes and presentation fidelity |
| Point-frame publication | Emitted code/transport size only | Flights, sparse packets and cancellation |
| Prepared orbit strokes | Emitted transport size only | Stroke fidelity, level selection and publication |
| Retained layout boundaries | Inline/CSS bytes only | Containment, invalidation and listener effects |
| Coasting freezes membership | Emitted code size only | Transform/opacity-only writes and deferred membership |
| World-context delta publication | Emitted code/transport size only | Delta ownership, publication and pixels |
| Marker declutter | Emitted code/transport size only | Picking, visibility, ordering and virtual card layout |

The [cold-tests method](../labs/performance/README.md#cold-tests) permits a page-filtered production build with the same emitted bundles. Both sides must use the same filter, asset origin and version/toolchain inputs. Global transport and chunk counts still cover all files emitted in that build; missing default pages fail rather than silently reducing coverage.

Part A cannot see actual bytes on the wire or negotiated compression, cold/warm cache behavior, browser request counts, long tasks, script evaluation work, DOM writes during coast/navigation or elapsed timing. Parts B and C own those measures. Passing part A alone does not prove the application is never slower.

## Breakage proofs and cost

[Breakage patches](../.github/scripts/performance/breakages/) exercise an extra preload, a forced chunk split, a lost lazy import, an extra head request and removal of a redundant preload. [The applicator](../.github/scripts/performance/breakages/apply.mts) requires a directory named `l7a-throwaway-*` with a `.performance-throwaway` marker containing `L7A DISPOSABLE COPY`; it refuses unexpected targets and symlink escapes. The retained builds are never patch targets.

The [offline proof runner](../.github/scripts/performance/offline-proofs.mts) measures the retained base twice, compares it with the parameter-injection and graph-movement builds, and tests extra preload/request declarations on sparse HTML copies. It writes route-by-route evidence into ignored `output/plan7/l7a/`. [Mutation checks](../.github/scripts/performance/mutations.mts) require failing tests after disabling increases, order checks, preload counts or dynamic imports, omitting inline script bytes, alphabetizing source import order, exempting real startup-method/chain/round keys, or ignoring each guarded declaration field. Rebuilt split/static-import proofs belong to the orchestrator; the guard itself never builds or publishes.

The cost is local file enumeration/stat calls, parsing emitted JavaScript and selected HTML, and fixed compression of chunks and startup transports. The full transport bank is statted, not read or recompressed. Compression results are cached per resource during each measurement. Cost measurements belong to the proof output and depend on the selected routes, filesystem and CPU; they are not a performance acceptance threshold.
