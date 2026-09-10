# Prepared object provenance

## Lineage contract

Every registered object uses the same `prepared/provenance.json` contract,
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
also runs this recovery. It does not download or rebuild body assets.

- `basis: recovered` means existing declared pins were bound. It does not prove
  that source bytes are present, that an acquisition happened in this run, or
  that a complete body was freshly reproduced.
- `basis: prepared` is emitted by the preparation pipeline after checking the
  bound source and output bytes. A changed input, recipe, output or binding
  invalidates that record. Recovery preserves a prepared record only when its
  full identity still matches.
- `pnpm prepare:provenance mercury --verify` checks locally available source and
  output bytes without claiming a fresh preparation run.

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
recorded as authored content. Its reference links alone do not establish
field-level scientific derivation. Shared scene credits retain their existing
separate owner. The compiler also supports Earth noise page records, but those
geographic views are absent from Earth's current descriptor. That binding does
not certify worldwide imagery coverage or remote availability.

## Source and mission presentation

The [Sources guide](sources-catalogue.md) owns published titles, citation links,
canonical bindings, credits and usage presentation. Local source records may
supply `title`, `sourceUrl`, `displayCredit` and `attributionGroup.id` for records
that remain local or unresolved. These fields never establish consumption.

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
