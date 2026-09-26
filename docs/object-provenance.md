# Prepared object provenance

[Navigation identity and evidence](navigation-identity.md) explains the explicit
observation-attribution policy and why a selectable dataset view can combine
several products and published sources.

## Lineage contract

Every registered scene package uses the same `prepared/provenance.json` contract,
`cssearth-object-provenance@3`. It connects local inputs to prepared outputs.
The file is generated and never committed. For layered scene bodies,
`tools/prepare/prepare-provenance.mts` regenerates it from the source manifest,
recipes and inventory during development and builds. Volume, image-layer and
catalogue packages publish their baked provenance through `inventory.json`;
asset setup restores it. To change the lineage, change its source records and
use the owning preparation path.
The [Sources catalogue](sources-catalogue.md) supplies the published identities
and combines usage across bodies. Neither infers dependencies from labels or URLs.

## Ownership and data flow

1. The object source manifest owns input identity, acquisition information,
   credits, rights and optional human-readable source titles and product URLs.
2. The authored recipe owns the transformation and its parameters. The shared
   preparation-family bindings in `tools/objects/provenance-recipes.mts` identify
   consumed inputs and outputs for each operation.
3. `prepareAuthoredObject` finalizes provenance after preparing assets, content
   and previews. The write path also finishes CSS bindings, navigation and page
   metadata in staging before publishing the outputs together.
4. The Sources compiler follows this lineage and each input's `sourceBinding`.
   It derives usage links to published works. The footer links the selected
   subject's README, where sources, unresolved inputs and limitations are
   documented. Dataset cards use contribution edges to identify their missions
   and observing equipment.

Each source has its declared path. The generator measures byte count and SHA-256
when the file is present; absent downloads are marked `download-not-present`.
These measurements in generated lineage are not manifest pins or proof that a
download matches earlier bytes. Each product records its
recipe, a JSON Pointer to the operation, any additional contributing recipes,
input IDs, parent products, output identities, interpretation and limitations.
Acquisition operations retain configuration-file dependencies recursively;
their inputs are checked as well as the final acquired product.
Preview products inherit their original dataset's input lineage. A recipe may
describe a scientific model or an illustration; recording lineage does not
turn either into an observation.

The manifest's `documents` collection includes provider labels and authored
records. It does not establish authorship. Preserve each document's origin,
credit and acquisition description; use `kind: authored-document` only for
project-authored records. The content recipe identifies authored page content.
Other documents default to `source-document`; missing credits or acquisition
details remain explicitly unrecorded. Generated intermediates retain their own
generator and source credits.

The validator rejects missing inputs, missing recipe operations, unpinned
outputs and dependency cycles. Unknown dataset operations remain explicit
coverage gaps. Extending a preparation family requires adding its actual
dependency binding and a behavioral test, not a body-specific UI condition.

## Existing assets versus a new preparation run

From the repository root, run:

```sh
node tools/prepare/cli/prepare-provenance.mts <object-id>
```

Omit the ID to regenerate all registered scene-body records. By default the
command validates and publishes their prospective lineage and both shared
catalogues together. `--objects-only` writes only the scene-body records; the
startup/build chains use it before preparing the catalogues. The command does
not rebake surface assets or regenerate volume/catalogue provenance.

Each invocation builds current lineage with `basis: recovered` and `verify: false`.
It does not retain an earlier record, accept `--recover`, or compare an authored
recipe with a stored manifest digest. Present sources and recipes are measured;
missing downloads remain explicit. Output identities come from the runtime
inventory or available prepared outputs. This establishes the recorded source
chain, not a fresh acquisition or a reproduced bake.

The authored preparation path can produce `basis: prepared` after checking its
bound outputs and records `lastPreparation` for that run. A later metadata
regeneration does not carry that snapshot forward as proof of a new run.
Preserve original execution reports under their owning evidence directory and
identify the revision and bytes they actually tested.

An acquisition operation records the declared request and processing policy,
when available. It is not a retrospectively invented execution receipt. Some
upstream requests only verify an existing source; these are recorded separately
as verification operations and never substituted for acquisition history. Some
legacy generated inputs and authored scientific specifications do not contain
complete upstream acquisition histories. Their identities remain recorded;
the compiler does not invent evidence to fill those gaps.

Coverage is explicitly `object-datasets-and-bound-rendering-products`.
This is not a claim of provenance for every scientific statement, every runtime
byte, the shared sky, or remote geographic delivery. Authored information is
recorded as authored content. The Sources compiler separately reads the
[citations on individual facts](factsheets.md); that records attribution, not
independent verification of the quantity. `generator.path` names the current
lineage compiler; it does not identify the implementation that originally made
an installed asset. Git revisions and original run evidence establish that history.
Shared scene credits retain their existing
separate owner. The compiler also supports Earth noise page records, but those
geographic views are absent from Earth's current descriptor. That binding does
not certify worldwide imagery coverage or remote availability.

## Publishing an authored preparation

The authored write path finishes CSS bindings, navigation, shared-bank transport,
page metadata and the descriptor in staging. Only then does
`tools/objects/publication.mts` publish images, minimaps, prepared JSON and root
metadata together through the existing `writePreparedSet` helper.

A caught write failure restores replaced and retired files and removes newly
created outputs. Backups stay on disk if rollback itself fails. Shared hash
banks are append-only dependencies: an unreferenced bank may remain after a
failure because another object may already use it.

The existing traced preparation receipts and coordinator keep their ownership;
this adds no receipt schema or locking system. Publication is offline and must
not overlap another writer for the same object. It does not provide an
instantaneous multi-file switch for live readers or recovery from process
termination or power loss.

The publication and prepared-set tests exercise staging, replacement and rollback.
Use the current tests beside `tools/objects/publication.mts` and
`tools/prepared/write-prepared-set.mts`, with their required inputs installed.
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
pnpm test:node
```
This is the broad native suite. For a focused change, select the relevant tests
under `src/platform/`, `tools/contract/`, `tools/sources/` and the affected preparer.
Report source-dependent skips separately. The suite does not reinstate the
removed manifest-pin or provenance-retention checks, and a pass does not replace
independent scientific qualification.

## Prepared context resources

Catalogue fields and image-layer galaxies use the same version-3 provenance
schema without becoming independently mounted scenes. Their source manifests,
recipes and prepared receipts feed the shared Sources compiler.

Their root `inventory.json` lists every baked file with its location. A
`prepared` entry's filename may contain safe relative subdirectories and
resolves below the object's `prepared/` directory; a `public` entry resolves
below `public/scenes/<id>/`, for shared dataset previews. Absolute paths,
parent traversal and symlink installation paths are rejected. Inventories list
byte counts and SHA-256 values for both locations; restored bytes must
match the root inventory. Prepared-directory verification preserves the root metadata receipts and
requires an explicit public root when public assets are listed, checking both
locations. The public-scene assembler rejects prepared resources before writes;
it must never prune object preparation records.

An explicit `--object=<id>` can select an inventoried context resource for
shared asset setup. Default scene selection is unchanged. An inventory does
not claim its files have been published to the runtime asset mirror. The Nearby
Universe's `pnpm prepare:galaxy-field` command acquires its configured catalogue
inputs, prepares its fields and refreshes shared lineage/catalogues; source and
generated-image caches remain ignored. Volume, image-layer and catalogue
`prepared/provenance.json` files are baked assets in their inventories. The
scene-body provenance generator does not reconstruct a missing record for them.
