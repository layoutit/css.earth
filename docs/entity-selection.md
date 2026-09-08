# Entity selection

One shared card presents the selected entity. Its kind is metadata: a city,
country or province does not introduce another shell or renderer. `OBJECTS` owns
renderable body packages; Argentina and Buenos Aires use the mounted Earth
scene. Selecting another body replaces that scene through the existing router.
The title, facts, sources, lens controls and parent links use retained shell nodes.

Every card owns its lenses explicitly. Earth exposes **Visible color** and
**Night lights**. Buenos Aires exposes **Visible color** and **Daytime noise**;
other geographic cards expose **Visible color**. Changing cards clears the active
observation. Dataset extent, geographic containment and parentage never grant
lens ownership. The prepared WorldCover Land cover package and its provenance
remain available to maintainers, but it is excluded from the current product.

The query encodes the shared camera; the fragment identifies the entity and
lens. Restoration loads the selected record and applicable observation, then
restores the saved camera without a destination flight. Back/Forward reuse the
mounted scene within Earth. Parent links use the same IDs, selection and history
owner as search. Superseded flights cannot overwrite a newer history entry.
Invalid IDs never fabricate a card or scene; an invalid camera token does not
prevent a valid entity selection.

## Sources and coverage

The pinned GeoNames catalogue has 38,252 records: 34,135 populated places, 252
countries/territories and 3,865 first-order administrative divisions. The country
count includes two explicitly historical records. The cities15000 snapshot is
not every settlement. All original IDs remain valid. City parents follow exact
country/ADM1 codes; 23 cities with an unmatched ADM1 retain their verified country
parent. Buenos Aires city belongs to its federal district, not Buenos Aires province.

Natural Earth and GeoNames shapes supply optional camera framing. A missing or
conflicting geometry join preserves the source entity and its location point;
726 administrative divisions and four countries have point views. Framing
extents are not rendered borders. The contract supports additional entity kinds
when their data and provenance are supplied; it does not include every crater,
mountain or administrative level.

Introductions use a generic Wikimedia lookup. A pinned Wikidata identity owns
the lookup when available; otherwise the client resolves and verifies the exact
GeoNames claim. The English Wikipedia article must match that identity. The
API's two-sentence plain-text excerpt is displayed unchanged with article,
contributors and CC BY-SA 4.0 attribution. Ambiguous or unavailable identities
leave the introduction empty. Requests cancel on navigation and successful
results use a bounded cache. No authored place descriptions or live geocoder are
hidden in the runtime.

Place coverage and imagery coverage are separate. Visible color combines the
prepared global base with regional backing and direct Terrascope WorldCover
2021 imagery. The prepared fine geometry covers the admitted provider
footprints within Web Mercator, including prepared polar pieces. Outside source
coverage the retained base remains usable. Footprint coverage does not certify
every source pixel; water, source gaps and finite-resolution fallbacks remain
possible. This feature does not supply terrain, buildings or survey accuracy.

The Buenos Aires observation uses the pinned APrA daytime-noise source and its
original sixteen prepared images and matrices. The shared card presents its
source, units and legend. It is a historical model, not live sensor data.
See [Earth source records](../src/planets/earth/SOURCE.md) for licenses, source
versions, acquisition recipes and coverage qualifications.

## Transport and retained rendering

Search is prepared ahead of runtime. A lazy worker verifies and decodes a
143,279-byte directory, a 4,741,271-byte compressed search index and requested
detail shards. The index contains 538,314 aliases. Queries return at most eight
labels; direct links load their record and ancestors without downloading search.
The 299 detail shards are at most 18,543 compressed bytes each. Detail residency
is bounded by sixteen shards and 4 MiB of decoded payload; directory and search
have separate 2 MiB and 20 MiB admission limits. These are payload limits, not
JavaScript heap ceilings. Leaving Earth terminates the worker and its transport.

Observations load only when selected. Their descriptors pin local packages by
length and SHA-256, including source identity, coverage, units, legend and
prepared page references. An indexed observation requests verified directory
ranges from the existing geometry release. Runtime transports prepared geometry
and images; it does not derive geometry, rasters, atlases or source indices.

The existing pager selects complete local replacement groups. Ready regions can
publish independently; unrelated metadata cannot hold all imagery back. A
covering ancestor survives until its own replacement is ready. Metadata admission
prioritizes covering branches before deeper detail, so fine records cannot
indefinitely crowd out adjacent coarse coverage. Coarse subtree bounds continue
to include polar detail that their own images may not contain.

Base imagery has 512 retained slots, at most 256 displayed pieces, a 128 MiB
conservative decoded reservation and a separate 96-directory / 12 MiB metadata
allowance. Observation paging has 32 slots, three image loads and a 128 MiB
allowance including any overview. Both reserve capacity for replacement.
Shared native image ownership deduplicates resources across pages and revisits;
idle reuse yields to current demand and expires after two minutes. Teardown
clears bindings, decode owners and blobs. Chrome's internal caches and total
process memory are separate from these application limits.

The regional backing release is approximately 374 MB; the existing 25.344 GB
fine geometry release is reused unchanged. Prepared retirement relationships
allow backing to yield capacity only where complete fine coverage is proven.
No catalogue-wide prefetch or raw-world raster download is required. See
[geographic streaming](geographic-streaming-architecture.md) for selection,
publication, source receipts and native-memory qualification.

The full-density base atlas has a separate cost: Visible color is delivered in
49 lossless shelf strips totaling 45,956,184 encoded bytes and approximately
381 MB decoded. This preserves the accepted source pixels while avoiding one
large image decode during travel. Night lights is a separate on-demand
11,446,468-byte bank. These base-atlas costs must not be hidden inside the small
paging budgets or described as free. Atmosphere stops requesting material above
its prepared zoom cutoff and resumes when returning to globe scale.

## Maintainer workflow

Restore the checkout's exact runtime assets with `pnpm setup:assets`. Normal
object preparation runs through `pnpm prepare:planets -- --object=earth`; it uses
the declared source recipe and pinned geometry, not a new worldwide geometry
build. Source changes require explicit intake and updated integrity receipts.

Observations share one release workflow:

```sh
pnpm datasets acquire --object=earth
pnpm datasets verify --object=earth
pnpm datasets prepare --object=earth
pnpm datasets validate --object=earth
pnpm datasets publish --object=earth --dry-run
pnpm datasets publish --object=earth
```

`acquire` restores exact pinned source bytes. Edited or corrupt existing files
fail verification instead of being overwritten. `--dataset=buenos-aires-noise`
or `--dataset=worldcover-land-cover` limits intake/preparation; validation and
publication include the complete shared Earth asset closure. Preparing the
retained Land cover package does not expose it in the product.

Publication uses the existing authenticated uploader, reuses byte-verified
objects and writes the content-addressed release manifest last. Interrupted
publication resumes; same-size corruption is not accepted through HEAD alone.
A release pins prepared local outputs, not every future response from a
versioned third-party imagery URL. There is no mutable latest pointer.

Install an exact data release into an owned directory with:

```sh
pnpm datasets install --object=earth --release=<full-release-sha256> --output=<owned-directory>
```

Application rollback also needs the corresponding Git checkout and a fresh
output directory. Data installation does not replace compiled application code.
Publishing assets does not deploy the site or merge its PR.

## Verification and delivery

The normal repository gates are `pnpm acquire:planets -- --verify-only`,
`pnpm test`, `pnpm build` and `pnpm test:browser <origin>`. Use real Chrome at
DPR 1 and 2. Focused built-app entry points are:

```sh
node tests/objects/browser/earth/card-lens-ownership-browser.mjs --built-dir=dist --dpr=1 --record=false
node tests/objects/browser/earth/exploration-browser.mjs --built=dist --journey=continuous-exploration --cycles=2 --dpr=1 --trace=false --output=<new-run-directory>
node tests/objects/browser/earth/global-recovery-browser.mjs --built-dir=dist --dpr=1
pnpm test:earth-delivery --built-dir=dist
```

Repeat the relevant browser cases at DPR 2. Exploration follows the visible
flight to the destination and then applies input immediately; it does not wait
for imagery between routine actions. It also deliberately interrupts flights,
corrects search, switches lenses/parents/history, goes offline, retries and
revisits. Its receipts retain exact served script hashes, action logs, network
lifecycle, screenshots and video. Separate runs without screenshots, video or
memory dumps measure observer overhead. A selected place label alone does not
prove geographic arrival or imagery coverage.

Built fixtures serve unchanged compiled files over local HTTPS while imagery
and geometry use the real public services. Their `css.earth` mapping applies
only inside the isolated test browser. This proves the production transport
path without deploying the application. Local uncompressed fixture startup is
not a production-hosting latency claim. Fault-injection runs qualify recovery,
not cache or performance behavior. CPU/network emulation is not physical phone
or trackpad evidence.

Delivery receipts separate application, R2 geometry, provider imagery and
editorial API requests, including cancellations and browser-cache reuse. Generate
the editable traffic model with
`node tools/objects/geographic-pages/operations/delivery-cost-report.mjs <delivery-report.json>`.
[Delivery assumptions](earth-delivery-assumptions.json) record dated unit prices,
cache assumptions and 100/1,000/10,000 daily-session scenarios. They are not a
live account invoice, a monthly budget commitment or a provider capacity promise.
The normal atlas, retained releases and long-session request counts are material
cost inputs. Terrascope service capacity remains an external dependency; direct
API access does not establish unlimited free service.

Merge, deployment, physical-device qualification and any absolute monthly spend
limit remain separate decisions. [PR #6](https://github.com/layoutit/cssEarth/pull/6)
is the review and delivery record for this feature.
