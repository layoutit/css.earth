# Prepared object provenance

[Navigation identity and evidence](navigation-identity.md) explains the explicit
observation-attribution policy and why a selectable dataset view can combine
several products and published sources.

## Lineage contract

Every registered scene package uses the same `prepared/provenance.json` contract,
`cssearth-object-provenance@3`. It connects local inputs to prepared outputs.
The [Sources catalogue](sources-catalogue.md) supplies the published identities
and combines usage across bodies. Neither infers dependencies from labels or URLs.

## Ownership and data flow

1. The object source manifest owns input identity, acquisition information,
   credits, rights and optional human-readable source titles and product URLs.
2. The authored recipe owns the transformation and its parameters. The shared
   preparation-family bindings in `tools/objects/provenance-recipes.mts` identify
   consumed inputs and outputs for each operation.
3. `prepareAuthoredObject` finalizes provenance after preparing assets, content
   and previews. The record travels with the other prepared JSON outputs.
4. The Sources compiler follows this lineage and each input's `sourceBinding`.
   It derives usage links to published works. `site/object-sources.mts` retains
   local and unresolved source disclosures in the common panel.

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

`pnpm prepare:provenance` recovers records for `OBJECTS` from checked recipes,
source manifests and prepared asset receipts. Development/build preparation
also runs this recovery. Catalogue preparation restores missing cited factsheet
documents from their pinned acquisition recipes before validating the citations.
It does not download or rebuild body rendering assets.

- `basis: recovered` means existing declared pins were bound. It does not prove
  that source bytes are present, that an acquisition happened in this run, or
  that a complete body was freshly reproduced. This is also the default when
  calling the lineage helper directly, even with byte verification.
- `basis: prepared` is emitted by the preparation pipeline after checking the
  bound source and output bytes. Only that pipeline requests `prepared`.
  A changed input, recipe, output or binding
  invalidates that record. Recovery preserves a prepared record only when its
  full identity still matches.
- `pnpm prepare:provenance mercury --verify` checks locally available source and
  output bytes without claiming a fresh preparation run.

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
