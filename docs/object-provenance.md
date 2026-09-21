# Prepared object provenance

[Navigation identity and evidence](navigation-identity.md) explains the explicit
observation-attribution policy and why a selectable dataset view can combine
several products and published sources.

## Lineage contract

Every registered scene package uses the same `prepared/provenance.json` contract,
`cssearth-object-provenance@3`. It connects local inputs to prepared outputs.
The file is a build output. `tools/prepare-provenance.mts` generates it from the
source manifest, the recipes and the prepared inventory during `predev` and
`prebuild`, and it is not committed. To change what it says, change those files.
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

Each source has its exact path, byte count and SHA-256. Each product records its
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

`pnpm prepare:provenance` brings the records for `OBJECTS` up to date from
checked recipes, source manifests and prepared asset receipts, and never weakens
one. Development/build preparation also runs it. Catalogue preparation restores
missing cited factsheet documents from their pinned acquisition recipes before
validating the citations. It does not download or rebuild body rendering assets.

- A body whose identity (pins, recipes, outputs, bindings) is unchanged keeps
  its record.
- A body whose identity changed is byte-verified: when every pinned input and
  output is on disk and matches, the new record is `basis: prepared`.
- When a pinned file is not on this checkout, a `prepared` record stays as it
  is, the body is named and the command exits 1; prepare it where its sources
  are. `--recover` writes a `basis: recovered` record instead, which binds the
  declared pins without proving the bytes were present. A record that was never
  prepared is recovered without the flag.
- `basis: prepared` is also emitted by the preparation pipeline itself after
  checking the bound source and output bytes.

`lastPreparation` separately retains the fingerprint of the last byte-verified
preparation and the lineage verifier's identity. It covers object identity,
source pins and dependencies, recipe pins, product bindings and output pins.
Metadata recovery carries it forward even when the compiler or credits change.
The preparation summary reports `material-matches`, `material-changed`, or
`not-recorded`; a retained fingerprint never grants verification to new bytes.
A new verified preparation replaces this snapshot. Git retains prior full records;
this is not an execution log or scientific acceptance certificate.

The 36 historical records recovered from before PR #208 include an exact Git
revision, path and file hash. Missing historical evidence is left unrecorded.

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
independent verification of the quantity. The `generator` hash identifies the
lineage compiler, not the implementation that originally made a recovered asset.
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

The publication and prepared-set tests inject failures after image replacement,
retirement and metadata writes. The Mimas finalization test checks that the real
CSS compiler reproduces its finalized runtime without changing canonical files.
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
pnpm test:sources
```
The suite checks tampered inputs/outputs/recipes, recovery semantics, compound
Mercury coverage, Saturn material dependencies, Earth noise identity, preview
inheritance, and preservation of source entries across the full registry.
Those checks qualify this contract; they do not replace complete object or
scientific qualification.

## Prepared context resources

Catalogue fields and image-layer galaxies use the same version-3 provenance
schema without becoming independently mounted scenes. Their source manifests,
recipes and prepared receipts feed the shared Sources compiler.

Their root `runtime-assets.json` declares `resourceRoot: "prepared"`. Asset
filenames may contain safe relative subdirectories; they resolve below the
object's `prepared/` directory. An asset with `location: "public"` instead
resolves below `public/scenes/<id>/`, for shared dataset previews. Absolute paths,
parent traversal and symlink installation paths are rejected. Inventories list
byte counts and SHA-256 values for both locations; the prepared mirror must
match the root inventory. Prepared-directory verification preserves the root metadata receipts and
requires an explicit public root when public assets are listed, checking both
locations. The public-scene assembler rejects prepared resources before writes;
it must never prune object preparation records.

An explicit `--object=<id>` can select an inventoried context resource for
shared asset setup. Default scene selection is unchanged. An inventory does
not claim its files have been published to the runtime asset mirror. The Nearby
Universe's `prepare:galaxy-field` command reproduces its assets from pinned
catalogue downloads and regenerates provenance; source and generated-image
caches remain ignored. `prepare:sources` recovers lineage from retained metadata receipts without
requiring downloads or prepared imagery. Available output bytes are checked,
but recovered records retain manifest-pin verification independently of the
local cache.
