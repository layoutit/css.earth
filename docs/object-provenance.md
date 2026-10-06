# Prepared object provenance

[Navigation identity and evidence](navigation-identity.md) explains the explicit
observation-attribution policy and why a selectable dataset view can combine
several products and published sources.

## Lineage

An object's provenance is its source records: the source manifest, the recipes
its descriptor names and, for volumes and catalogue contexts,
`source/presentation.json`. No generated provenance file is written or
published. The facilities and sources catalogues build each object's lineage
(which manifest sources each prepared product reads) in memory from those
records when they compile, and nothing else keeps it. To change the lineage,
change its source records.
The [Sources catalogue](sources-catalogue.md) supplies the published identities
and combines usage across bodies. Neither infers dependencies from labels or URLs.

## Ownership and data flow

1. The object source manifest owns input identity, acquisition information,
   credits, rights and optional human-readable source titles and product URLs.
2. The authored recipe owns the transformation and its parameters. The shared
   preparation-family bindings in `packages/bake/src/objects/lineage/lineage-recipes.ts`
   identify the inputs each operation consumes; `body-lineage.ts` beside it
   reads a layered body's records into its lineage. A volume's datasets read their
   own image, their declared further inputs and the shared inputs its
   `source/presentation.json` names. A catalogue context declares its products
   and their inputs in the `provenance` block of its `source/presentation.json`.
3. The Sources compiler follows this lineage and each input's `sourceBinding`.
   It derives usage links to published works. The footer links the selected
   subject's README, where sources, unresolved inputs and limitations are
   documented. Dataset cards use contribution edges to identify their missions
   and observing equipment.

Each product records its label, the datasets it shows, its input IDs, parent
products, interpretation and limitations. Acquisition operations
(`source/preparation/acquisition.json`) add the file an input was built from, and
its conversion recipe, as dependencies of that input. A dataset that borrows
another dataset's plates has that dataset as its parent. A recipe may describe a
scientific model or an illustration; recording lineage does not turn either into
an observation.

The manifest's `documents` collection includes provider labels and authored
records. It does not establish authorship. Preserve each document's origin,
credit and acquisition description; use `kind: authored-document` only for
project-authored records. The content recipe identifies authored page content.
Other documents default to `source-document`; a missing credit remains
explicitly unrecorded. Generated intermediates retain their own generator and
source credits.

The lineage check rejects unknown inputs, parents and datasets and dependency
cycles. A dataset whose preparation family has no binding has no product, so it
credits no source. Extending a preparation family requires adding its actual
dependency binding and a behavioral test, not a body-specific UI condition.

After changing source records or bindings, rebuild the catalogues:

```sh
node site/build/prepare/prepare-facilities.mts --catalog-only
```

The lineage establishes the recorded source chain, not a fresh acquisition or a
reproduced bake. Preserve original execution reports under their owning evidence
directory and identify the revision they actually tested. An acquisition
operation records the declared request and processing policy; it is not a
retrospectively invented execution receipt. Some legacy generated inputs and
authored scientific specifications do not contain complete upstream acquisition
histories; the compiler does not invent evidence to fill those gaps.

The lineage covers an object's datasets and the rendering products their recipes
bind. It is not a claim of provenance for every scientific statement, every
runtime byte, the shared sky, or remote geographic delivery. The Sources compiler
separately reads the [citations on individual facts](factsheets.md); that
records attribution, not independent verification of the quantity.

## Publishing an authored preparation

The authored write path finishes CSS bindings, navigation, shared-bank transport,
page metadata and the descriptor in staging. Only then does
`packages/bake/src/delivery/publication.ts` publish images, minimaps, prepared JSON and root
metadata together through the existing `writePreparedSet` helper.

A caught write failure restores replaced and retired files and removes newly
created outputs. Backups stay on disk if rollback itself fails. Shared hash
banks are append-only dependencies: an unreferenced bank may remain after a
failure because another object may already use it.

This adds no receipt schema or locking system. Publication is offline and must
not overlap another writer for the same object. It does not provide an
instantaneous multi-file switch for live readers or recovery from process
termination or power loss.

The publication and prepared-set tests exercise staging, replacement and rollback.
Use the current tests of `packages/bake/src/delivery/publication.ts` and
`packages/bake/src/delivery/write-prepared-set.ts` (`packages/bake/src/delivery/publication.test.mts`,
`packages/bake/src/delivery/write-prepared-set.test.mts`), with their required inputs installed.
These checks do not replace a visual or scientific oracle.

## Source and mission presentation

The [Sources guide](sources-catalogue.md) owns published titles, citation links,
canonical bindings, credits and usage presentation. Local source records may
supply `title`, `sourceUrl`, `displayCredit` and `attributionGroup.id` for records
that remain local or unresolved. These fields never establish consumption.

Products may declare `inputEvidence` for consumed source IDs: appearance,
geometry, placement, registration, calibration or reference, with evidence for
the role. The reader rejects unconsumed inputs and duplicate source/role pairs.
An undeclared role remains `unknown`. Parent products retain their roles;
acquisition dependencies do not inherit a scientific role automatically.
Contribution edges expose these roles alongside their credits.

Captured inputs also carry `capture.attributions`. A spacecraft or mission claim
needs evidence from the input; participation alone does not establish a dataset
contribution. The [exploration guide](architecture/exploration-catalog.md) owns
these fields, artwork, contribution graphs and dataset navigation.

After changing either kind of attribution, use the
[coordinated preparation command](sources-catalogue.md#prepare-and-check).

## Validation

For source bindings or product-lineage changes, run:

```sh
pnpm test:site
```
This is the broad native suite. For a focused change, select the relevant tests
under `packages/objects/src/provenance/`, `packages/bake/src/objects/lineage/body-lineage.test.mts`,
`site/journeys/context-lineage.test.mts`, `src/sources/factsheet-sources.test.mts` and the affected preparer.
Report source-dependent skips separately. A pass does not replace independent
scientific qualification.

## Prepared context resources

Catalogue fields and image-layer galaxies feed the shared Sources compiler from
their source manifests and `source/presentation.json` without becoming
independently mounted scenes.

Their root `inventory.json` lists every baked file with its location. A
`prepared` entry's filename may contain safe relative subdirectories and
resolves below the object's `prepared/` directory; a `public` entry resolves
below `site/public/scenes/<id>/`, for shared dataset previews. Absolute paths,
parent traversal and symlink installation paths are rejected. Inventories list
byte counts and R2 content addresses for both locations; restored bytes must
match the root inventory. Prepared-directory verification preserves the root metadata receipts and
requires an explicit public root when public assets are listed, checking both
locations. The public-scene assembler rejects prepared resources before writes;
it must never prune object preparation records.

An explicit `--object=<id>` can select an inventoried context resource for
shared asset setup. Default scene selection is unchanged. An inventory does
not claim its files have been published to the runtime asset mirror.
