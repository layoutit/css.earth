# Prepared object provenance

## Lineage contract

Every registered object uses the same `prepared/provenance.json` contract,
`cssearth-object-provenance@2`. The Sources card reads this record. It does not
infer inputs from factsheet citations, lens labels, URLs or publisher names.

## Ownership and data flow

1. The object source manifest owns input identity, acquisition information,
   credits, rights and optional human-readable source titles and product URLs.
2. The authored recipe owns the transformation and its parameters. The shared
   preparation-family bindings in `tools/objects/provenance-recipes.mts` identify
   consumed inputs and outputs for each operation.
3. `prepareAuthoredObject` finalizes provenance after preparing assets, content
   and previews. The record travels with the other prepared JSON outputs.
4. `site/object-sources.mts` projects those records into attribution groups.
   The common information panel renders each product link on its own line and
   the shared credit once underneath. Grouping never combines input identities
   or replaces their links with one publisher homepage.

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
also runs this small migration. It does not download or rebuild body assets.

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

## Sources presentation metadata

An input may declare `title`, `sourceUrl`, `displayCredit`, and an optional
`attributionGroup.id` in its source manifest. These fields describe that input;
they never determine whether it was consumed. The underlying source record
retains the original origin, full credit, license and acquisition details.

The card uses regular underlined links and muted shared credits. License codes
are retained in the provenance record and omitted from the card. Authored
content files and a direct link to the project's provenance JSON are omitted.
Other internal files without external source links also remain in the record
rather than appearing as links in the card. Product-page metadata and explicit
acquisition or verification URLs provide the external link; malformed URL
templates are never turned into clickable citations.
No body-specific markup is needed for new objects.

## Missions and spacecraft behind a dataset

Captured inputs declare an explicit `capture.attributions` list in their source
manifest. Each attribution names an individual spacecraft, an individual mission,
or an unresolved source credit, and retains its evidence text. A spacecraft claim
may name its mission when the source establishes that pair. Mission participation
alone never establishes a dataset contribution.

The shared [exploration catalogue guide](architecture/exploration-catalog.md)
defines the catalogue fields, migration inventory and authoring workflow.
`src/platform/exploration-contributions.mts` follows product parents and source
dependencies at preparation time. It emits one contribution graph with object,
mission and spacecraft indexes, and deduplicated dataset destinations. Schematic
interiors and synthetic spectral models do not inherit observing missions from an
outer reference texture. Observation-derived elevation and shape products retain
their evidenced attributions.

The Missions tab presents individual missions and their datasets on the current
body. Expandable spacecraft details distinguish mission participation from
observation contribution and link to other evidenced dataset views. Agency counts
use individual mission IDs. Status is a sourced claim with an explicit date;
absence of an end date does not imply current activity.

`pnpm prepare:spacecraft` validates the catalogue, contribution graph and approved
artwork. It does not download or render images. The render and emblem libraries
retain their existing source URLs, credits, hashes and dimensions. Vehicles and
missions refer to those assets explicitly; suitable artwork is optional. A joint
illustration is not assigned as a portrait to each participating vehicle.

Dataset summaries are authored beside each object's full description. The card
uses a three-line summary area; the original description remains available in
the text's tooltip and source content. Legends use only declared scales and
category meanings. Every dataset reserves the same 28px band and single-line
label area after its preview. When no legend is supplied, that slot says so;
image palettes and brightness placeholders are not substituted for data legends.

After changing capture metadata, run `pnpm prepare:provenance`. This validates all
new provenance and the exploration catalogue before replacing the prepared set.
The preparation-only `tools/objects/migrate-provenance-v1.mts` validates the old
format during migration; browser consumers accept only the current format. Validate with
`node --test site/test/dataset-spacecraft.test.mjs site/test/object-sources.test.mjs tools/object-provenance.test.mjs`.

## Validation

Run:

```sh
node --test tools/object-provenance.test.mjs site/test/object-sources.test.mjs site/test/scene-sources.test.mjs site/test/dataset-spacecraft.test.mjs
pnpm typecheck:preparation
```
The suite checks tampered inputs/outputs/recipes, recovery semantics, compound
Mercury coverage, Saturn material dependencies, Earth noise identity, preview
inheritance, and preservation of source entries across the full registry.
Those checks qualify this contract; they do not replace complete object or
scientific qualification.
