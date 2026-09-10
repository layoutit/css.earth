# Sources catalogue

The Sources tab connects published inputs to the prepared datasets that use them.
Each source has an external citation link and a complete **Used in cssEarth** list.
Those links use the existing dataset navigation: they select a dataset on the
current body or navigate to another body in the shared scene.

[SOURCES](../src/sources/catalog.json) owns published identities. Body manifests
still own local files, acquisition, byte hashes, credits and reuse terms.
Mission and spacecraft fields cite SOURCES with their own checked dates and
locators. Artwork and shared environments retain their existing provenance owners.
A mission reference, illustration or shared sky source does not become an
observation merely because it appears beside a body.

## Find the record to change

| Record | What it owns |
| --- | --- |
| [Canonical catalogue](../src/sources/catalog.json) | Stable source IDs, published work or release, identifiers, citation links and evidenced relationships |
| Body `source/manifest.json` | Original local input IDs, file identities and `sourceBinding` |
| [Mission catalogue](../site/source/spacecraft/catalog.json) | Claim-specific citations, checked dates and exact locators |
| [Render library](../site/source/spacecraft/render-library.json) and [emblem library](../site/source/spacecraft/emblem-library.json) | Artwork bindings, original credit, preparation and byte pins |
| Shared environment `source/provenance.json` | Environment binding and its scientific meaning and qualifications |
| [Prepared sources](../site/prepared-sources.json) | Generated usage edges, dataset destinations, inventory and dependency hashes |
| [Migration fixture](../tests/fixtures/sources/migration.json) | Explicit inherited decisions and the frozen pre-migration identity of each affected manifest and metadata owner |

Keep numerical evidence in the body README and its existing data or recipe, as
required by the [provenance contract](provenance/CONTRACT.md). The catalogue does
not duplicate scientific tables or retain explanatory webpages. Historical
identity evidence points to its original record and Git revision; it does not
claim a new check of a provider website.

## Bind an input

An input has exactly one binding:

- `catalogued`: one or more canonical IDs, each with a material, method,
  reference or artwork role and evidence for the relationship.
- `local`: an explicitly authored recipe, presentation specification or local
  measurement, with a reason. It cannot erase an external dependency already
  recorded in product lineage.
- `unresolved`: the inherited label, evidence and reason the identity remains
  uncertain. Preparation permits only the unchanged decisions in the migration
  fixture. A new or changed external input needs a resolved identity.

Every manifest input is classified, including retained inputs no longer used in
the prepared view. An unused input creates no active usage edge. Used documents
and intermediates also have bindings; placing a file in `documents` does not
make it authored content.

A hash identifies local bytes. It does not establish a provider version or make
two local files the same published work. Preserve a release only when its version
is evidenced. HYG v4.1 and v4.4, for example, are separate releases of one work.
Mercury's monochrome, enhanced-colour and shaded-relief products stay separate,
although their credits overlap. Paired PDS image and label resources can bind to
one archive product; the local files and their original identities stay separate.

Use explicit relations and redirects when curating identities. The validator
rejects duplicate provider identities, dangling references, redirect chains and
relation cycles. Do not merge records from a common publisher, endpoint, credit,
file hash or approximate title. The initial migration preserves uncertain
identities rather than assigning them a guessed release or published product.

## Prepare and check

Run `pnpm prepare:sources` after changing sources or their bindings. This is the
same coordinated operation as `pnpm prepare:provenance` and
`pnpm prepare:spacecraft`: it builds prospective object provenance and both
catalogues, validates every reference and dataset control, then stages all outputs
before replacement. Both catalogues share a dependency closure and canonical
catalogue hash. Astro rejects stale or mixed prepared sets.

The migration tool, `node tools/migrate-source-bindings.mts`, applies only the
checked historical manifest mapping. It rejects changed input records and existing
conflicting bindings. Normal preparation never runs this migration or guesses
an identity from a URL.

The source graph walks the existing product dependency graph. It includes
schematics and models, which the mission observation graph deliberately excludes.
Each edge preserves its local credit, terms, interpretation and limitations.
Shared context is indexed once by feature; mission metadata and artwork are
separate consumer kinds with no object or lens attribution.

[Contract tests](../src/platform/source-catalog.test.mts) cover identity and citation
validation. [Catalogue checks](../tools/source-catalogue.test.mts) conserve product dependencies, reject invalid
prospective sets, and check deterministic preparation. The existing provenance,
mission and publication tests continue to cover their respective contracts.

`node tools/check-source-migration.mts` is the one-time comparison with the frozen
PR #112 baseline. It checks all retained fields, old mission citations and the
unchanged observation graph. It is separate from the normal suite so later,
properly evidenced source updates do not need to rewrite a historical fixture.

## Delivery and coverage limits

The complete catalogue and graph are build inputs. Only the current body's
relevant disclosures become page HTML. Sources and Missions are omitted from the
inert navigation preview bank and filled by the existing page transport. There is
no source-specific request, route, hash grammar or global search, and no additional
scene owner.

Coverage includes manifest inputs and used provenance documents/intermediates,
mission and spacecraft metadata citations, the approved spacecraft artwork and
four shared environment credits. Factsheet values, gallery descriptions, chart
annotations and arbitrary prose citations are not all indexed. A missing usage
edge outside that scope does not prove a source is unused throughout the project.

The migration starts from documentation cleanup PR #112, commit
`8d2f45b58b5ea9a0b69a81242c51aa6e6d6ebcdf`. Its 473 bodies retain 2,595 manifest
inputs, 8,253 documents and 444 generated intermediates. Scientific inputs,
prepared textures, rendering and artwork bytes are unchanged by this feature.
Historical source records remain historical evidence at that revision; current
preparation and browser results must be assessed at the feature revision that ran
them.

## Browser evidence

At `c4c1523dedf63d2a3e635c829261d34413fcc3a9`, the
[production browser report](../tests/evidence/sources-catalogue/browser.json)
passes 13 mission and source navigation scenarios in Chromium 152.0.7977.84,
including keyboard disclosure, camera retention, same-body and cross-body links,
reload, history and a 390 × 844 mobile viewport. It records the served HTML, CSS
and JavaScript hashes; DPR is 1. The [payload measurements](../tests/evidence/sources-catalogue/payload.json)
find no source cards in the 473 inert preview templates on each sampled page.
These reports test the application revision above; the following commit adds only
this explanation and its evidence.

The broader [shell test output](../tests/evidence/sources-catalogue/shell.log)
records 319 passes and seven failures: one audit finds 141 stale frame receipts,
and six navigation preparation checks lack original solar imagery in this checkout.
The [baseline comparison](../tests/evidence/sources-catalogue/inherited-frame-failures.json)
identifies the affected objects and the unchanged documentation baseline. The
complete platform suite was not run for this feature.

Mercury's Sources disclosure identifies the enhanced-colour product and links to
its dataset while the monochrome map remains selected. The screenshots show the
desktop and mobile layouts from the browser run above.

![Mercury Sources disclosure on desktop](images/catalogue-sources-desktop.png)

![Mercury Sources disclosure on mobile](images/catalogue-sources-mobile.png)
