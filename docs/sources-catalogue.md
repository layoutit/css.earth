# Sources catalogue

The Sources tab links published works and data products to the datasets that use
them. A shared source has one identity across bodies; each body keeps its own
input bytes, processing, credits and limits.

## Find the record to change

| Record | Content |
| --- | --- |
| [Source records](../src/sources/) (`<id>.json`) | One published identity per file: title, identifiers, version, citation links and evidence |
| Body `source/manifest.json` | Local input IDs, paths, hashes, acquisition, credits and `sourceBinding` |
| Body `README.md` | Adopted values, source choices, processing, results and known problems |
| [Mission and spacecraft catalogue](../site/source/spacecraft/catalog.json) | Citations for individual claims, with checked dates and locators |
| [Render library](../site/source/spacecraft/render-library.json) and [emblem library](../site/source/spacecraft/emblem-library.json) | Artwork bindings, original credits and file pins |
| Shared environment `source/provenance.json` | The source binding and meaning of that environment |

`site/prepared-sources.json` and `site/prepared-spacecraft.json` are generated
from these records and the existing product lineage. They are ignored build
outputs; do not edit or commit them.
The [provenance contract](provenance/CONTRACT.md) governs citations, retained data,
evidence and plain language. Keep scientific tables in their existing records.

## Add or update a source

1. Look for the published work or release in the catalogue. Reuse its ID across
   bodies and file conversions. Preserve distinct releases and distinct products
   within a collection. A publisher, shared download endpoint or matching hash
   alone does not establish equivalence.
2. If it is absent, create `src/sources/<id>.json`, with `id` matching the filename.
   Use the existing [source record fields](../src/platform/source-catalog.mts).
   Add its published title, provider identifiers and citation link.
   Record authors, date and version when established by the source. Cite the
   provider page with a checked date and locator, or an existing record at its
   exact Git revision with its hash and field. Do not invent a release or archive
   identifier. Use `relations` for evidenced versions, parts and derivations.
3. Add a `sourceBinding` to the body's input. It names the canonical ID, the
   source's role (`material`, `method`, `reference` or `artwork`) and the evidence
   connecting it to this input. Keep the local ID and byte pins. Used documents
   and intermediate files also need bindings.
4. Update the body README when the source choice, values, processing or limits
   change. Follow [preparation and checks](#prepare-and-check) below.

A local recipe, measurement or display specification uses `kind: local` with a
specific reason. Its external inputs remain connected through product lineage.
A converted image is still derived from its published source; conversion does
not create a new published work.

When consolidating duplicates, verify the published identity, update the current
bindings and remove the redundant records. Each local input keeps its own pins.
Preparation rejects missing, unknown or unresolved bindings. Establish the source
identity from its evidence before publishing the prepared catalogue.

Independent additions touch separate files. Changes to the same published source
still need to be reconciled. There is no shared index to update: preparation
reads the files in ID order and rejects duplicate identities.

## Prepare and check

Run `pnpm prepare:sources` after changing catalogue metadata, bindings or capture
records. `pnpm prepare:provenance` and `pnpm prepare:spacecraft` are aliases for
this coordinated operation. It validates all prospective object provenance and
both catalogues before replacing outputs. Astro checks their dependency hashes
and the source file list, rejecting stale or mixed sets. It does not acquire
scientific data or rebake surface assets.

Source-refresh tools must preserve bindings, source metadata and capture evidence
while updating byte pins. Newly discovered files need an authored classification;
a refresh must not guess one from a filename or copied template.

For source identities, bindings or catalogue code, run:

```sh
pnpm test:sources
```

This prepares the catalogues and checks identities, bindings, product dependencies,
independent additions and deterministic output. CI runs the same command.
It needs installed dependencies, without scientific downloads or a surface bake.
Use the [exploration guide](architecture/exploration-catalog.md#preparing-and-checking-a-change)
for changes to mission attribution or dataset navigation. Scientific changes still
need their body and preparation checks.

## Coverage and delivery

The graph covers manifest inputs, used provenance documents/intermediates,
mission and spacecraft citations, approved artwork and shared environments.
Unused retained inputs create no usage edge. Factsheets, gallery descriptions,
chart annotations and prose citations are not all indexed. A missing edge outside
this scope does not establish that a source is unused throughout the repository.

Only relevant source cards become the current body's page HTML. The inert
navigation previews omit Sources and Missions; the existing page transport fills
those panels. The complete catalogue and graph remain build inputs.

## Interface examples

![Mercury Sources disclosure on desktop](images/catalogue-sources-desktop.png)

![Mercury Sources disclosure on mobile](images/catalogue-sources-mobile.png)
