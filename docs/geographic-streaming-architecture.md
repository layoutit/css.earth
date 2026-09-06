# Geographic streaming

The shared application shell owns the selected entity and its explicit lenses. The existing prepared-map pager owns geographic detail and drawable coverage. One geographic image owner manages transport, decoding and bounded reuse, and the retained CSS renderer applies prepared image handles and transforms.

Local publication/loading and shared image reuse are implemented. A bounded coarse-to-fine prototype now preserves the existing fine selection in captured boundary crossings. Global preparation and the complete continuous browser journey remain unfinished. Controlled native-memory results and the remaining browser-owned residency are reported below.

## Ownership

```mermaid
flowchart TD
  S[Existing object and lens lifetime] --> P[Prepared-map pager]
  C[Existing camera] --> P
  E[Earth preparation] --> I[Prepared index]
  I --> P
  P -->|admitted requests| R[Geographic image owner]
  R -->|readiness and leases| P
  P -->|complete local swaps| D[Retained CSS slots]
```

- Keep one shared shell, generic object adapter and mounted object scene. Entity kind does not create a new renderer or card. Every card owns its lenses: land cover belongs to Earth and the noise observation belongs to Buenos Aires. Camera position selects base imagery detail independently of card identity.
- Reuse the existing object and geographic lens lifetime for cancellation, dataset revisions, clearing old observations and teardown. Do not add a second dataset session or general layer manager.
- Earth preparation owns projection, geometry, source sampling, imagery, error bounds, provider addresses and any coverage relationships needed for replacement. Runtime may project prepared bounds for selection and decode/transport prepared records; it cannot generate scene geometry or images.
- The pager owns desired detail, current useful coverage, metadata demand and affordable complete replacement decisions. Keep selection and publication as small policy functions while sufficient. If their fallback histories diverge or coverage decisions spread into loaders, consolidate that state into one prepared-map controller.
- Strengthen the existing geographic image transport and share it with pages and overviews under the scene lifetime. Consumers hold leases. Do not wrap a second cache around it or rewrite fixed object-atlas residency.
- Retained CSS slots execute prepared writes. Publication and accounting use what actually becomes drawable, not a promise that an image will arrive.

## Selection, loading and publication

Keep coverage nodes, image resources and CSS pieces distinct. Multiple pieces can share one image. A complete drawable group may contain several pieces and images. Image readiness alone does not prove group coverage.

1. Select from the current view and prepared bounds/error records. Never use selected city or card kind as the level-of-detail signal.
2. Distinguish unknown metadata from a known empty branch. Unknown branches preserve useful previous coverage; they do not authorize retiring it. Continue bounded metadata discovery through expensive intermediate nodes because finer polar groups can require fewer visible pieces.
3. Load admitted images whose metadata is available. An unrelated directory request must not stop them. Preserve bounded retry, timeout, source validation and cancellation.
4. Publish each complete child group as soon as its pieces are ready. Keep its covering ancestor beneath unfinished siblings, retiring that ancestor when its complete selected replacement is drawable. A selected parent likewise replaces related old descendants. Unknown metadata preserves existing coverage. Release obsolete offscreen groups.
5. Reserve old plus incoming resources before work begins. Publish the new complete cut and retire replaced leases in one synchronous transaction. A late result cannot publish into a newer slot generation or dataset revision.
6. Under reversal, prioritize current coverage and visible detail. Useful ancestors and previously displayed descendants may remain while needed; avoid an unconditional ladder of all ancestor loads or unbounded prefetch.

For a cold view without related displayed imagery, the pager may request an available prepared ancestor before the desired detail. It selects an affordable ancestor image group only when it costs less than the missing desired images, or when unknown descendant metadata needs coverage. It does not load every intermediate level or put new coarse imagery over displayed detail. Auxiliary ancestors share the existing old-plus-incoming slot and byte reservations. Their failure does not block fine-image requests; cancellation, lens changes and teardown release their handles through the same page lifetime.

A packed metadata response that ends short despite correct range headers gets one retry, bypassing the HTTP cache with `cache: reload`. Both attempts share the same metadata reservation, load slot and 30-second deadline. Aborted requests do not retry. Repeated short transfers, invalid ranges, hash failures and invalid expanded data remain visible failures with explicit user retry; no unverified metadata is published.

## Resource limits

Preserve the mounted ceilings and their explicit meanings. Base paging has 512 retained slots, at most 256 displayed pieces, a conservative 128 MiB decoded reservation, and a separate 96-directory / 12 MiB metadata allowance. Observation paging has 32 slots and its existing byte allowance including overview costs. Additional backing must be included in the combined accounting; it cannot obtain invisible capacity by becoming another layer.

Keep separate accounting for conservative per-piece/raster cost, unique image resources, encoded blobs and in-flight payloads. Existing per-piece reservation is deliberately conservative. Sharing an image does not authorize a larger DOM/compositor load. Adding new byte categories under an unchanged number changes admission semantics and must be evaluated explicitly.

The existing image transport now owns one native decoded image and blob URL per verified resource. Base pages, observation pages and observation overviews acquire leases from this owner. A page releases its lease after clearing its CSS binding. Successful load deadlines cannot release a displayed image; cancellation of one pending consumer does not cancel another consumer of the same image. Corruption or a failed decode invalidates the resource for future reuse.

Layer scopes preserve their existing decoded ceilings. Active references are charged per CSS piece; idle resources once per unique image. Base residency admits at most 512 image identities; the observation scope admits its 32 page identities plus the existing 64 overview identities within the same 128 MiB decoded allowance. Idle entries yield in least-recently-used order to visible demand. They expire after two minutes, or earlier when provider freshness expires; `no-store` and `no-cache` responses do not enter idle reuse. Immutable prepared files still require the declared length and SHA-256. An encoded envelope of the decoded limit plus 64 KiB per admitted image bounds pending payload reservations, following the existing PNG transfer ceiling.

Eviction or scene destruction revokes retained blobs and clears native decode owners. Loader reservations and transport counters span complete fetch, body verification and decode work. Existing per-layer loading concurrency remains unchanged; there is no additional global scheduler.

Earth's prepared atmosphere material has a maximum camera zoom of 4. Above that scale, the shared material publisher clears its image and material demand requests no atmosphere rows. Returning to globe scale restores the current row if the user's atmosphere setting remains enabled. The retained element and checkbox preference remain unchanged; other object packages retain their own material behavior.

Application ledgers do not bound Chrome's internal caches. Repeated lens-switch and teardown traces must establish whether reuse produces a native memory plateau. Blob identity reuse alone is not completion evidence.

The 6 September 2026 comparison used real Chrome 152 on an Apple M3 Max, a 1440 × 1000 viewport and nine repeated Earth/land-cover → Buenos Aires/noise round trips. Both control runs disabled atmosphere through its checkbox to isolate geographic images. Retaining blob URLs alone did not stop native cache growth; retaining the decoded native image identity did. During cycles 2–9, sampled `cc/image_memory` allocator accounting was:

| Transport | DPR 1 | DPR 2 |
| --- | ---: | ---: |
| Original release-on-exit transport | 761–972 MB | 766–985 MB |
| Shared decoded image ownership | 575.130–575.139 MB | 575.657–575.926 MB |

At the ninth return, the original transport had created 1,245 / 1,317 blob identities; shared ownership had created 118 / 121. The shared images retained approximately 9.6 / 9.9 MB of encoded bytes within the existing layer scopes. Final visible page keys and imagery hashes matched at both DPRs. City/noise map pixels matched in the saved-view comparison; globe differences were zero pixels at DPR 1 and six at DPR 2, with no source-image change.

These controls do not represent the default atmosphere-enabled application's total residency. With shared image ownership and the zoom cutoff, that application's sampled image-cache peaks were 2.56 / 2.49 GB and still fluctuated during globe travel. Earth-to-Mars teardown returned allocator accounting to approximately 236 MB for the remaining Mars scene. These are Chrome allocator measurements, not physical RAM or a hard application-controlled GPU limit. Uninterrupted travel and its worst presentation intervals remain a separate qualification.

## Coarse-to-fine representation

The current fine WMTS release remains unchanged. At regional views, a selected cut can require more CSS pieces than the display limit. Loading policy alone cannot make those same pieces fit.

Prototype a bounded coarse backing in accepted face coordinates using existing preparation functions and pinned RGB samples. Start with backing that remains beneath opaque fine detail. Measure its residency together with displayed and incoming detail, and inspect transparency, apron overlap and depth order. Only prepare regional retirement relationships where measured budget pressure requires reclaiming backing. Existing face identifiers and crops help preparation, but bounding rectangles alone do not prove pixel coverage.

Normal backing belongs to base imagery. The current observation-overview path suspends normal detail, so that lifecycle cannot be reused unchanged for backing intended to support the detail. Preserve explicit observation ownership and clearing.

The polar bridge needs a measured endpoint: existing preparation omits cap pieces below WMTS L10, and the first available cap cut may still exceed capacity. Adding only L0–L4 ancestors does not resolve this. Keep coarse coverage until an affordable fine cut exists, including cap/band transitions and both hemispheres; beyond source coverage, retain the accepted base. Include actual antimeridian crossings, not only a stationary view near the dateline.

Begin with one regular seam, one cap/band seam and an antimeridian transition. Compare retained backing with regional retirement only where needed. Verify source/result/difference frames at DPR 1/2, continuous replacement, metadata admission, image count, piece count, simultaneous reservations and release size before global expansion. Do not duplicate the 25 GB fine geometry release or acquire the whole raw imagery dataset.

### Implemented prototype and qualification boundary

Unconditionally reserving backing reduced fine detail under the existing display
ceiling: one captured regular view fell from 254 fine pieces to 217. Conditional
retirement therefore lives in the existing selector and publisher. Preparation
maps the nontransparent source support, including its sampling margin, to known
fine-index branches. Runtime follows these prepared relationships; missing or
pending metadata cannot certify replacement. A ready local fine group can replace
its covering backing independently of an unrelated delayed region. Every view
change re-evaluates those relationships before old coverage is retired.

Demand reserves the old displayed cut and the complete incoming required cut
before admitting optional backing or ancestors. Optional coverage cannot consume
the capacity needed to finish the replacement that releases the old view. Empty
prepared images do not enter the ancestor demand. Nonempty polar backing remains
until an affordable covered cut is available; the prototype does not infer polar
replacement from regular-face relationships.

Preparation also removes transparent image margins while retaining the existing
quad and texture mapping. Crop edges align to the original CSS pixel grid: arbitrary
tight crops preserved source texels but changed browser resampling and were
rejected. For the 254-page pinned prototype, aligned cropping reduces conservative
decoded image storage from 68,681,600 to 34,898,880 bytes. Encoded WebP size remains
approximately 11.46 MB. This is a finite fixture footprint, not a global release
or measured browser-memory reduction.

Five actual pointer crossings and reversals at each DPR cover a regular boundary,
the antimeridian, northern and southern cap boundaries, and a northern view under
display pressure. All 20 initial/settled camera checkpoints preserve the baseline
fine selection and published fine keys; sampled retained DOM, image and metadata
accounting stays within the original limits. These runs start at prepared poses.
They do not establish uninterrupted globe-to-city loading or worldwide coverage.

The crop comparison uses six controlled screenshots per DPR with equal recorded
camera matrices, scale and viewport. All three nonempty northern checkpoints are
pixel-exact in an aligned DPR 1 run and in the final DPR 2 run. Repeated captures
also show small browser variation: up to one channel value in a few DPR 1 pixels,
and a mean absolute channel delta of 0.006573 in a repeated DPR 2 southern base-only
view. Final comparisons stay within measured A/A variation; zero-tolerance failures
and raw differences are preserved. This is calibrated screenshot agreement, not
universal pixel parity. Existing PolyCSS seam bleed remains unchanged.

The normal release does not yet include this backing. Global preparation,
and the complete built entity/lens/history journey
remain required before enabling it.

Continuous fixture runs cover regular and antimeridian regions,
the northern cap boundary, and interiors at 80 degrees north and south, each at
DPR 1 and 2. Each run uses two uninterrupted globe/city/drag/reversal cycles,
delays one metadata request by 2.5 seconds, and injects one imagery HTTP 503.
All ten retries recover, obsolete page requests cancel, and 3,140 recorded
samples retain the same scene nodes and original resource limits. The largest
sampled cut displays 226 pieces; simultaneous image reservations peak at
60,003,492 bytes and metadata at 12,582,637 bytes. Complete requested groups
are not withheld in any sample. These are 200 ms observations, not proof of zero
transient publication latency or a performance measurement.

In the eight runs with visible source detail, 12–45 nonempty pages publish while
the delayed directory remains pending. Northern interior backing remains visible
through expensive fine cuts, with fine imagery appearing near maximum zoom.
Both southern interior runs instead carry prepared empty-source records and
retain the base map; they cancel the delayed directory when it becomes obsolete.
That is source-empty behavior, not proof of useful fine imagery in Antarctica.
The fixture's base-only cold/warm transition observations last approximately one
sample in the other regions. Additional real pointer crossings of the provider's
85.0511287798066-degree boundary pass in both hemispheres at DPR 1/2. Eight
initial/settled checkpoints preserve the fine selection and actual published
fine keys. Northern views can still include covered pixels below that latitude;
the southern fixture remains source-empty. Global release and the complete built
entity/lens/history journey still need qualification.

### Reproducible global coarse preparation

The preparation command uses the existing pinned source inventory and accepted
face geometry. It prunes only conclusive geometric or inventory absence; a
downsampled transparent image cannot prove that finer source islands are absent.
Source mip selection measures the prepared texel footprints, and acquisition
uses the provider's low-resolution WMTS levels. It does not rebuild the fine
geometry or download the full raw COG dataset.

Run these phases from the repository root:

```sh
pnpm prepare:earth-coarse --phase=plan
pnpm prepare:earth-coarse --phase=acquire
pnpm prepare:earth-coarse --phase=prepare
```

Planning writes `.local/coarse-global/<plan-version>/plan.json` and checkpoints
after every 64 pages. Acquisition retains per-tile receipts, hashes and source
headers. `--seed-manifest=<pinned-wmts-manifest.json>` reuses verified files by
hardlink when possible; `--offline` verifies the complete input closure without
network access. It uses at most four simultaneous transfers, 2 GiB of pinned
input bytes, 320 KiB per response and an 8 GiB free-space reserve. Provider errors
and corrupt cached bytes remain explicit failures. Partial completion resumes
from completed receipts.

The current complete plan contains 450 roots, 6,914 pages, and 12,034 source tile
addresses at WMTS levels 2–8. The largest planned page uses 32 source tiles
(8 MiB decoded). These are preparation counts, not runtime requests per session,
storage measurements, or a claim of useful imagery at every coordinate.

Preparation preserves source row orientation and checks every nontransparent
pixel through lossless encoding. It writes aligned crops and retirement
certificates into the existing page/index format. Images and directories are
content addressed; a resumed preparation preserves the same canonical manifest.
The source decode cache stays within 48 MiB, output assets within 1 GiB. The
completed release is under `releases/<release-version>/` beneath the plan
directory; `prepared.json` identifies that local directory.

Publish only the new release's files through the existing Earth bucket workflow,
then integrate its verified manifest:

```sh
pnpm publish:earth-coarse <prepared-release-directory> --dry-run
pnpm publish:earth-coarse <prepared-release-directory>
pnpm integrate:earth-coarse <prepared-release-directory>
```

`--verify-only` can finish verification after an interrupted upload. Integration
requires the public delivery receipt, exact fine root closure and geometry
version. Regenerating the same fine release preserves its backing; changing that
release requires new backing certificates. The existing image owner, metadata
queue, retained slots and runtime budgets remain shared. Publishing data does
not deploy the site or qualify the complete browser journey.

## Traversal dependency

Cesium's source is a useful reference. Its quadtree can execute without a WebGL provider, but its private traversal assumes geographic child construction, terrain fills in some partial-readiness cases, and selection history committed before display callbacks. Prepared topology, CSS-pixel error and hard publication admission need additional semantics. An npm export does not make those private assumptions a supported prepared-page contract.

There is no mandatory Cesium dependency. Consider a pinned extraction only if a real prepared coarse/fine fixture demonstrates that it removes substantial selection/fallback policy, records what actually publishes and requires no second selector to repair its output. Otherwise maintain the existing prepared-map owner. Bundle size or WebGL elsewhere in the package is not the deciding factor.

Reference inspected: CesiumJS commit `488b114e16f5879f5d51456640aae67850a715c0`, particularly [QuadtreePrimitive](https://github.com/CesiumGS/cesium/blob/488b114e16f5879f5d51456640aae67850a715c0/packages/engine/Source/Scene/QuadtreePrimitive.js). If code or tests are copied/adapted, preserve applicable licenses/notices and mark modifications; keep data-provider attribution separate. Source research does not warrant branding the application Cesium-powered. [License](https://github.com/CesiumGS/cesium/blob/488b114e16f5879f5d51456640aae67850a715c0/LICENSE.md).

## Completion evidence

Complete the same PR with continuous cold/warm globe-to-region-to-city exploration, reversals, interrupted travel, delayed/failing imagery and metadata, offline recovery, lens/history changes and sustained revisits. Run real Chrome at DPR 1/2; label narrow viewport and CPU/network emulation honestly. Capture visible checkpoints and videos separately from performance measurements so screenshot overhead is not blamed on the application.

Run source verification, tests, build and OBJECTS-derived browser conformance appropriate to the final changes. Refresh delivery-cost scenarios from actual request/cache behavior. A stable metadata selection can still have blocked directories, and representative coverage does not establish worldwide valid pixels, physical-device behavior or provider availability. Merge and deployment remain the user's decisions.
