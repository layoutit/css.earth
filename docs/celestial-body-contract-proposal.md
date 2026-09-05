# One-PR action plan: prove the generalized celestial-body contract

Status: Implemented locally; all three adversarial-review findings are fixed and final gates pass. See [implementation evidence](objects-contract-implementation.md).

Date: 2026-09-03

Delivery: One total pull request

Target object: Pluto (selected by the user)

## Outcome

Deliver one pull request that adds one real source-backed celestial body and
repairs only the shared contract gaps that this body proves.

The pull request is accepted only as a whole. It must include the target-owned
package, any necessary shared contract changes, registration, migration of all
existing objects, tests, fresh visual evidence, and the complete readiness
gates. No contract fragment is merged separately.

The completed work must still use:

- one `OBJECTS` registry;
- one generic object adapter;
- one shared shell;
- one mounted retained-DOM scene;
- one retained camera;
- the shared camera, input, motion, speed, and lifecycle behavior;
- reproducible prepared assets selected once per mount; and
- Saturn as the visual, interaction, lifecycle, and performance reference.

Do not build a general capability framework in advance. Do not let a package
declare a required behavior unsupported to avoid its proof.

## Domain

The contract covers one Sun-, planet-, moon-, dwarf-planet-, asteroid-, or
comet-like body that can satisfy the existing interactive-body model.

It does not cover multiple simultaneous scenes, free-flight environments,
galaxies, nebulae, orbital-system simulators, dashboards, canvas, WebGL, or SVG
scene rendering. Such a target requires a separate architecture decision.

## Mandatory contract

Every object in `OBJECTS` must satisfy all of the following. These are not
optional features.

1. The object has one unique id, canonical route, lazy loader, and owned package.
2. The package owns exact sources, notices, preparation, runtime assets, page,
   tests, browser bridge, and production assembly.
3. Source and runtime bytes form checked, reproducible closures.
4. Runtime mounts exactly one stable retained-DOM scene and one camera.
5. Runtime may decode and transport prepared state only.
6. Runtime does not derive source data, geometry, charts, atlases, or rasters.
7. Runtime makes no source-authority request.
8. Runtime does not use `clip-path`, masks, filters, gradients, blend modes,
   canvas, WebGL, or SVG scene rendering.
9. The canonical highest-density prepared asset bank is selected once at mount,
   independent of browser DPR.
10. `ready`, `pause()`, `resume()`, and idempotent `destroy()` satisfy pre-ready,
    visibility, teardown, and restoration behavior.
11. Drag direction, inertia, wheel policy, zoom bounds, surface fly-to,
    interruption ownership, mobile page flow, Motion, and speed follow the
    shared policy.
12. Root acquisition, preparation, tests, browser proof, and assembly discover
    every registered object from `OBJECTS`.
13. Real Chrome proves the same highest-density bank at standard and doubled
    screen scaling. These are display conditions, not separate asset modes.

The pull request must not represent these requirements with Boolean capability
flags.

## Pull-request scope rule

Select the target body first. Compare its honest requirements with the mandatory
contract. Include a shared change only when the target exposes a concrete gap.

The pull request may contain these seams when proved necessary:

| Demonstrated target blocker | Allowed shared change |
| --- | --- |
| No honest lens feature | Make lenses an optional executable browser-profile block |
| No NASA editorial snapshot | Remove NASA editorial data from generic package validation |
| Hyphenated id or display name with spaces, digits, punctuation, or supported Unicode | Derive filenames and exports safely from the id and validate title glyphs |
| Cannot appear in search or navigation without an id branch | Derive search from `OBJECTS`, specialized views from classification, and markers from generic prepared input |
| No object-specific Shadows control | Make the shadow operation optional while keeping Settings and Motion universal |
| Does not use cubic sky or directional-Sun presentation | Move named renderer assertions to neutral platform and participating package tests |

If the target does not expose a blocker, omit that seam from the pull request.

If the target cannot satisfy the mandatory camera, input, motion, speed,
lifecycle, retained-DOM, preparation, or forbidden-renderer contract, stop. Do
not weaken the contract inside this pull request.

## Execution inside the single pull request

The following gates are sequential review points inside one pull request. They
are not separate pull requests and are not independently mergeable.

### Gate 1: qualify the real target

Record:

- object id, display name, and classification;
- mean heliocentric distance in AU;
- source repositories, files, versions, hashes, licenses, and redistribution
  status;
- native or source-rendered visual oracle;
- required prepared inputs and outputs;
- expected retained scene structure;
- expected camera and input behavior;
- available shell content; and
- demonstrated current-contract blockers.

Deliver an object-owned `SOURCE.md` and a concise fit report. Separate source
facts from authored presentation.

Stop if the source closure, license path, preparation route, or visual oracle is
unresolved. Do not register a placeholder or fallback scene.

### Gate 2: bind a trustworthy baseline

Start from a resolved known state or an isolated worktree created from an
explicit commit. Do not assume the current dirty checkout is the baseline.

Record in the pull-request evidence:

- commit and worktree path;
- initial `git status --short`;
- prepared asset hashes;
- served working directory and URL;
- browser name and version;
- viewport and DPR;
- fresh Saturn reference captures; and
- focused and aggregate baseline results.

Stale servers, stale captures, different prepared bytes, and different framing
are invalid comparison evidence.

### Gate 3: build the target-owned package

Develop the object under `src/planets/<id>/`. Keep it out of `OBJECTS` until its
owned closure and any required shared seams are complete.

The package must provide:

- `SOURCE.md`;
- `NOTICE.md` and applicable license files;
- `source/manifest.json` and checked distributable inputs;
- `tools/acquire.mjs` with `--verify-only`;
- `tools/prepare.mjs`;
- `tools/verify-source-manifest.mjs`;
- `tools/compact-production-assets.mjs`;
- deterministic prepared scene and asset outputs;
- `runtime-assets.json`;
- `runtime/client.mjs`;
- an object-owned page, panel, head, and required overlays;
- object-owned tests;
- a browser profile implementing every mandatory core operation; and
- fresh visual evidence against the accepted source or native oracle.

The package may reuse neutral platform helpers. Object-specific rendering facts
remain inside the package.

### Gate 4: implement only proved contract seams

Use only the relevant sections below. Every included seam must migrate all
existing objects and remain inside this same pull request.

#### Optional executable lenses

Affected shared files:

- `site/test/load-browser-profile.mjs`
- `site/test/planet-browser-conformance.mjs`

Keep readiness, camera, bounds, stability, runtime presence, retained-image,
density, and retained-node operations mandatory.

Move lens operations and audit data into one complete executable profile block.
Block presence discovers the feature; it does not prove it. Reject:

- a partial block;
- legacy lens methods outside the block;
- a block without matching rendered controls, runtime operations, and assets;
  and
- rendered lens controls, runtime lens APIs, lens state, or lens requests without
  the block.

For an object with lenses, retain selection, race, rejection, destruction,
decode-sharing, and retained-identity proof. For an object without lenses, prove
that it exposes no lens UI, API, state, loading marker, or asset request.

Camera, fly-to, motion, speed, lifecycle, density, mobile, retained-DOM, and
request suites remain unconditional.

#### Provider-neutral package validation

Affected shared files:

- `tools/object-package-contract.mjs`
- `site/test/object-package-contract.test.mjs`

The generic validator continues to require source and runtime manifests, owned
tools, runtime, page, tests, browser profile, and asset closure.

It must not require `data/planets/<id>.json` or call
`planetInformationSource()` as a condition of being a valid object package.

Do not relocate existing NASA files. Existing packages continue to prove exact
NASA ids, URLs, titles, retrieval dates, hashes, interpretation, and prepared
panel content through their owned acquisition, preparation, manifests, and
tests.

Add a temporary-directory package fixture with no editorial dataset. This
fixture proves only the generic validator. It is not a product route or visual
acceptance object.

#### Safe object identity

Affected shared files:

- `tools/prepare-planet-title-sources.mjs`
- `tools/object-package-contract.mjs`
- their focused tests

Required behavior:

- `halleys-comet` becomes `HALLEYS_COMET_TITLE_SOURCE` for generated exports;
- `halleys-comet` becomes `HalleysCometPage.astro` for the component stem;
- display names are not used as paths or identifiers;
- title preparation accepts supported display characters;
- missing glyphs and line-box overflow fail clearly; and
- outputs for existing objects remain byte-identical.

Do not rename `src/planets/`, `.planet-*` selectors, or existing public paths.

#### Registry-derived search and navigation

Affected shared files may include:

- `site/object-schema.mjs`
- `site/objects.mjs`
- `site/planet-search-objects.mjs`
- `site/components/PlanetObjectResults.astro`
- `site/components/PlanetaryScale.astro`
- `tools/prepare-navigation.mjs`
- their focused tests

Required behavior:

- generic search includes every `OBJECTS` entry;
- membership in `OBJECTS` is the only implementation state;
- classification describes an object and cannot disable core tests;
- a planet enters the logarithmic planet view through classification, not an id
  list;
- a non-planet remains available in generic search;
- shared shell code contains no object-specific marker table;
- package-owned marker preparation feeds one generic marker component; and
- physical `distanceAu` remains the single preparation and scale value.

The fixed eight planets may remain only in benchmark and reporting tools.

Any intentional navigation change requires a reviewed shell diff. It cannot be
reported as zero full-page visual difference.

#### Optional Shadows operation

The Settings action, Settings panel, and Motion control remain universal.

If the target lacks a Shadows control, represent only that object-specific
operation as one complete executable profile block. Validate the rendered
control, runtime state, toggle, restoration, retained overlay, and cleanup in
both directions.

Replace the fixed-eight shadow test with `OBJECTS`-derived behavior. Do not add a
Boolean `shadowLighting` field or a general settings framework.

#### Renderer-specific proof ownership

Cubic sky, directional Sun, rings, moons, atmosphere, weather, material banks,
and lighting banks remain package rendering facts.

If the target does not use one of the currently assumed systems, move named
system assertions from root shell smoke into neutral shared-platform tests and
the browser tests of participating packages. Root conformance must still prove
for every object:

- shell behavior;
- camera and input response;
- stable retained identity;
- fixed mount-time density;
- no forbidden renderer;
- no runtime preparation; and
- no external source request.

Do not remove evidence. Change its owner only when the target demonstrates the
need.

### Gate 5: register the completed object

After the package and all necessary seams are complete:

1. Add one record to `site/objects.mjs`.
2. Add one thin static route under `site/pages/`.
3. Confirm the generic adapter contains no object-specific branch.
4. Confirm root orchestration discovers the object automatically.
5. Confirm generic search and applicable navigation views include it.
6. Confirm no shared runtime or shell file contains a new target-id branch.

Do not add an unfinished object to `OBJECTS`.

### Gate 6: run final acceptance

Run from the exact candidate state:

```sh
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser
```

The pull request also requires:

- real Chrome evidence for every registered route at both screen scaling
  conditions, using the same highest-density bank;
- fresh target screenshots and source/native comparison;
- fresh Saturn reference and candidate captures with identical framing and
  prepared bytes;
- zero changed Saturn scene pixels;
- zero unintended shared-shell pixel changes;
- a separately reviewed expected diff for intentional navigation changes;
- one scene and one camera per route;
- stable retained DOM and bounded declared on-demand growth;
- no runtime source-authority request;
- no forbidden renderer or runtime preparation; and
- no regression in Saturn interaction, lifecycle, or performance evidence.

Green unit tests, a synthetic fixture, a stale screenshot, or a different
workload do not establish acceptance.

## Adversarial tests required by included seams

Add only tests relevant to seams present in the pull request.

Universal tests:

1. A profile cannot omit a core camera or lifecycle method.
2. A package cannot disable drag, fly-to, Motion, speed, density, or retained-DOM
   proof.
3. A registered object cannot bypass source or runtime closure.
4. Shared non-reporting code contains no fixed eight-planet id list.
5. A synthetic fixture cannot enter production `OBJECTS` without a complete
   package and route.

Lens tests, when the lens seam is included:

1. A partial lens block is rejected.
2. Lens methods outside the block are rejected.
3. A block without matching controls is rejected.
4. Controls without a block are rejected.
5. Lens ids match controls, runtime state, and prepared requests exactly.
6. A lens-free object makes no lens asset request.

Identity tests, when the identity seam is included:

1. A hyphenated id produces valid deterministic exports and filenames.
2. A display name with spaces, digits, or punctuation prepares successfully or
   fails with a precise glyph or line-box error.
3. Existing title outputs remain byte-identical.

Navigation tests, when the navigation seam is included:

1. Every registered object appears in generic search.
2. A registered non-planet stays out of the primary-planet scale without an id
   branch.
3. A registered planet enters the scale without adding its id to shared code.
4. Marker preparation and presentation contain no shared id-keyed table.

## Single-PR review structure

The pull request may use reviewable commits, but it remains one pull request and
one merge decision. Suggested commit groups are:

1. Target source closure and preparation.
2. Target retained runtime and owned tests.
3. Each demonstrated shared seam with its migration and adversarial tests.
4. Registration, route, documentation, and final evidence.

Every intermediate commit must build or be clearly marked as an internal
non-merge point. The pull-request head must contain the complete migration. Do
not open follow-up pull requests for contract completeness known during this
work.

## Stop conditions

Stop and report the concrete blocker when:

- lawful acquisition or redistribution is unresolved;
- exact prepared or oracle bytes cannot be proven;
- the target cannot satisfy the mandatory interactive-body contract;
- the proposed fix requires a second registry or target-specific adapter branch;
- the fix would make camera, fly-to, motion, speed, lifecycle, density, or
  retained-DOM proof optional;
- active changes overlap required shared files and no trustworthy baseline is
  available; or
- Saturn comparison evidence is stale, mismatched, or invalid.

Do not fabricate a fallback, weaken a test, or split known completion work into
a later pull request.

## Definition of done

The one pull request is complete when one real source-backed body is added
through:

- one owned package;
- one thin static route;
- one `OBJECTS` record;
- only shared changes proved necessary by that body; and
- no target-specific branch in shared shell, adapter, router, orchestration, or
  runtime code.

The target and every existing object pass all readiness gates. Optional features
are proved through executable behavior, mandatory interaction remains
unavoidable, Saturn retains its accepted standard, and no known contract
completion is deferred to another pull request.

## Explicitly deferred

Unless the selected target proves a need inside this pull request, do not add:

- a general capability framework;
- a second interaction model;
- optional camera or fly-to behavior;
- dynamic route discovery;
- wholesale editorial relocation;
- broad settings abstraction;
- broad sky or lighting abstraction;
- directory or selector renames; or
- support for arbitrary non-body scenes.
