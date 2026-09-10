# Missions, spacecraft and dataset attribution

`OBJECTS` owns navigable scenes. `MISSIONS` owns individual missions.
`SPACECRAFT` owns physical science vehicles. A spacecraft can serve more than one
mission, and a mission can operate several spacecraft. The mission's participant
list owns that relationship; reverse participation is derived.

The catalogues live in
[`site/source/spacecraft/catalog.json`](../../site/source/spacecraft/catalog.json)
under `cssearth-spacecraft-catalog@2`. They do not add scene loaders, routes or
camera owners. Mission and spacecraft IDs are scoped to their domains: spacecraft
Juno does not refer to the independently registered asteroid Juno.

## Authoring and validation

[`exploration-catalog.mts`](../../src/platform/exploration-catalog.mts) validates
unknown input and returns immutable records. Names, descriptions, vehicle kinds,
agencies, dates and status claims carry reference IDs. Reference records include a
source URL, title and check date, with an optional locator. Participation requires
its own references. Agency records use the existing
[agency owner](../../site/source/agency-logos.json); a logo is optional.

Dates retain their supplied precision. A year is not expanded to an invented
January date. Validation rejects impossible calendar dates and date intervals
that establish an end before a start. An active status must include its `asOf`
date and cannot contradict a known earlier end. The card displays the claim's
date instead of describing it as live status.

Separately operated science vehicles get separate records. Instruments,
containers and return capsules are not automatically spacecraft records. Routine
extensions, encounters and manoeuvres do not automatically create new missions;
use the source's distinction. This initial catalogue covers the migrated missions
and their science vehicles, including the OSIRIS-APEX successor. It is not a
catalogue of every historical mission.

Artwork references use `imageId` and `emblemId`. The approved
[render library](../../site/source/spacecraft/render-library.json) and
[emblem library](../../site/source/spacecraft/emblem-library.json) own the asset
bytes and credits. An emblem represents a mission. Group artwork remains mission
artwork; the individual GRAIL vehicles have text details rather than duplicate
portraits of the pair. The old Viking artwork remains in its approved library,
without being relabelled as a specific orbiter or lander.

## Capture evidence and the prepared graph

Source manifests use one of three explicit capture forms:

```json
{
  "capture": {
    "attributions": [
      {
        "kind": "spacecraft",
        "spacecraftId": "osiris-rex",
        "missionId": "osiris-rex",
        "evidence": "The specific pinned source label or archive reference."
      }
    ]
  }
}
```

A `mission` attribution supplies `missionId` and `evidence`. An `unresolved`
attribution supplies `label`, `evidence` and `reason`. Vehicle-only attribution
omits `missionId`; the compiler must not choose one from participation. Evidence
may be prose and must not be manufactured into a URL. The Sources tab retains the
source's original archive and acquisition links.

The [contribution compiler](../../src/platform/exploration-contributions.mts)
walks the existing source/product lineage, including dependencies and parent
products. Each edge retains its object, product, source, lens IDs and attribution.
All forward and reverse indexes come from this one edge set. Dataset destinations
are deduplicated by `(objectId, lensId)`; multiple evidence edges remain distinct.
Mission-only evidence creates no vehicle contribution edge. Participation creates
no observation edges.

The compiler validates every authored capture, including inputs outside the
current products. It validates product lens IDs against prepared page controls,
checks those controls against the object's scene identity, and retains the
existing exclusions for schematic interiors, illustrative models, modeled noise
and schematic morphology. Empty attribution stays empty; names, publishers,
mission targets and aliases are not association rules.

[`prepare-spacecraft.mts`](../../tools/prepare-spacecraft.mts) writes one prepared
catalogue containing the validated records, artwork, graph and closure hashes.
The hashes cover source records, every body manifest/provenance/page/descriptor,
registry and compiler owners, and approved artwork bytes. The common
[site entry point](../../site/exploration-catalog.mts) verifies these pins and
exposes `MISSIONS` and `SPACECRAFT`. A stale catalogue fails the build. Astro
renders the current body's cards and relevant vehicle details; the browser does
not receive the complete graph or walk source provenance.

The shared inert sidebar previews omit mission details. Selecting a body still
shows its prepared preview immediately; the existing `/navigation/<id>/` content
request supplies its mission panel before the destination controls become active.
The content transport fills that deferred panel while retaining the preview's
overview and controls. It does not create a separate catalogue fetch or preload
every body's mission markup.

## Migration inventory

The starting catalogue contained 24 mixed mission/vehicle/group entries. The
migration creates 26 individual missions and 36 physical vehicles. It preserves
all 374 authored capture evidence strings and the 371 captures consumed by the
current provenance. Three authored captures remain unconsumed: Earth's
`nasa-black-marble-2016` and `nasa-blue-marble-december`, and Phoebe's
`cassini-mosaic`. Their presence does not create new visible dataset links.

| Previous identity | New representation | Dataset result |
| --- | --- | --- |
| 22 individual vehicle entries | Stable spacecraft IDs and explicitly named same-ID missions in the migration inventory | Existing vehicle and mission associations remain attached to their original sources |
| `viking` group | `viking-1` and `viking-2` missions; an orbiter and lander for each | Mars, Phobos and Deimos collective Viking credits remain unresolved; no invented per-vehicle or per-mission links |
| `grail` group | One `grail` mission; `grail-a` (Ebb) and `grail-b` (Flow) spacecraft | The Moon's existing GRAIL credit becomes mission-level evidence; membership alone does not attribute its map to each vehicle |
| `osiris-rex` with “Active as APEX” | One enduring vehicle with an OSIRIS-APEX alias; separate OSIRIS-REx and OSIRIS-APEX missions | Bennu datasets retain OSIRIS-REx attribution; APEX has participation and no invented Bennu contributions |
| Deployed science vehicles absent from the old flat map | Huygens, Galileo's atmospheric probe, Philae, MINERVA, three MINERVA-II rovers and MASCOT | These are participants; they acquire no observation links without capture evidence |

The source references are beside the fields in the catalogue. Existing dated
status claims keep their original 8 September 2026 check date. New identity and
participation references were checked on 10 September 2026. Vehicle launch dates
remain separate from successor mission start dates. The year-only Viking ends
now describe the individual full missions, including their landers; the old
collective 1980 date described the orbiters.

The explicit preparation-only [version 1 migration](../../tools/objects/migrate-provenance-v1.mts)
is the sole compatibility boundary. Normal consumers validate
`cssearth-object-provenance@2` and never infer old group identities in the browser.
Preparation validates the full prospective output set before staging files and
replacing them. A validation failure leaves the previous prepared files intact;
closure checking rejects interrupted or stale mixed output.

The schema migration recovers records from the existing source, recipe and output
pins. It does not claim a new scientific preparation run or fresh source-byte
verification. Records whose metadata changed therefore use `recovered` and
manifest-based verification; their source and rendered-asset hashes remain the
same. A subsequent verified preparation can establish new byte-verification
evidence through the existing provenance workflow.

## Dataset navigation

A dataset view has a normal body URL, such as `/moon/#dataset=crust`. The fragment
represents the committed selection. Unrelated existing fragments are preserved.

The generic scene lifecycle exposes optional `datasets` with `ids`, `defaultId`,
`current()`, `select(id, { signal })`, and `subscribe(listener)`. Deferred mounts
expose it after readiness. Selection uses the existing asset-residency transaction:
unknown IDs and failed decoding reject, cancelled work resolves `false`, and a
successful publication resolves `true`. Cancellation settles before a pending
image decode and cannot publish after a newer navigation.

The router owns both the fragment and history:

- A same-body dataset link preserves the camera and pushes one history entry
  after the dataset commits.
- A cross-body link uses the shared camera handoff, selects after scene readiness,
  and commits one destination entry. Dataset failure leaves the destination's
  default available and publishes a canonical URL with a notice.
- Manual lens selection replaces the current history entry. It does not fill the
  back stack with every lens click.
- Ordinary body/overview navigation removes the departing dataset choice. Back
  and forward restore the saved camera and dataset, using the default when the
  fragment is absent.
- An invalid initial fragment stays visible for diagnosis while the default is
  shown. A valid selection or navigation clears that state.
- The Datasets tab opens after a requested dataset succeeds. No router simulates
  a click on a lens button or changes the object scene registry.

## Interface examples

The Moon illustrates the distinction between a mission contribution and vehicle
participation. GRAIL links to the Crust dataset, while GRAIL-A and GRAIL-B are
labelled as mission participants. These desktop and phone examples were captured
from the production build with application sources at `bfc4ed3a682300c08cf324f23bbd5a6afd060fa1`.
The [browser evidence](../../site/test/evidence/dataset-navigation-2026-09-10.json)
records the cases, viewports, settings, build-file hashes and image hashes.

![GRAIL mission, Crust dataset link and individual spacecraft on desktop](../images/catalogue-moon-missions-desktop.png)

![GRAIL mission and individual spacecraft on a phone](../images/catalogue-moon-missions-mobile.png)

## Preparing and checking a change

Run `pnpm prepare:provenance` after changing capture records. It stages provenance
and catalogue output together. Run `pnpm prepare:spacecraft` for catalogue/artwork
changes when provenance is already current. Neither command acquires artwork or
regenerates surface geometry.

Run `pnpm typecheck` and `pnpm check:typescript-ownership`, the package, renderer,
platform and shell test suites, and the production build. Focused tests include
`src/platform/exploration-catalog.test.mts`,
`site/test/dataset-spacecraft.test.mjs`,
`src/platform/object-selection-runtime.test.mjs` and
`site/test/navigation-router.test.mjs`. They cover malformed records, source
conservation, reverse links, deterministic output, cancellation and history.

Run `pnpm test:browser:datasets <production-preview-url>` against an assembled
build. The [browser regression](../../site/test/dataset-navigation-browser.mts)
uses the public shell and records its cases, browser version, requests and
screenshots under `output/playwright/dataset-navigation/`. It checks direct,
same-body and cross-body dataset navigation, manual selection and history,
invalid links, keyboard details, individual contribution labels, namespace
isolation and the phone layout.

Browser qualification must use the real shared shell: direct dataset loads,
same-body and cross-body links, manual selection, back/forward, failed links,
agency keyboard behavior and vehicle details at desktop and mobile widths. Check
one mounted object, retained shell controls and unchanged shared interaction
behavior. A catalogue association establishes the source relationship; it does
not certify missing texture files or remote delivery availability.
