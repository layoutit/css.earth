# Reproduce the distant-world models

These helpers extract the published numerical models for ʻOumuamua, Sedna,
Gonggong, Orcus, Salacia, Varuna, Varda, Máni and Achlys. Each body's README
owns its source interpretation, evidence and unresolved alternatives.
[Inputs](inputs.json) supplies the exact values used by the authoring scripts;
the body-owned `source/measurements.json` records the adopted interpretation.

## Source extraction and preparation

Run from the repository root with its supported Node version and dependencies.
Use one preparation process at a time. The original preparation used a 3 GiB
Node heap, `UV_THREADPOOL_SIZE=1` and `VIPS_CONCURRENCY=1`.

1. Restore a body's pinned originals with
   `node tools/objects/dist/operations.js acquire <id>`.
2. For ordinary regeneration, run the existing preparer directly:
   `node tools/objects/dist/prepare-authored.js <id> --write`.
   The checked-in radius table and source recipes are sufficient.
3. To update the selected numerical models, run
   `python3 tools/objects/source-authoring/distant-worlds/author.py`.
   It updates the existing packages from the input table, keeping current source
   bindings and other package metadata. Run
   `node tools/objects/source-authoring/distant-worlds/finalize-sources.mts`,
   then prepare each changed body.
4. Prepare changed marker sources with `pnpm prepare:navigation <id>`.
   Prepare the selected body to bind its stable marker URL.
5. Install published runtime assets with `pnpm setup:assets --object=<id>`.

`register.py` writes each body’s catalogue metadata and creates its astronomy
record when missing. Existing astronomy records are preserved. `finalize-sources.mts --refresh-pins` only refreshes source
pins; omitting that flag also prepares title and context source images.

`author.py` and `register.py` accept an input JSON path as their first argument;
`finalize-sources.mts` accepts `--inputs=<path>`. This selects the exact bodies
to rewrite. Author the current source manifest and its canonical bindings before
extracting a new body; the extractor does not infer source identities.
The six later models use [outer-worlds/inputs.json](../outer-worlds/inputs.json).
An input file may set `referenceDirectory` for its downloaded originals.
After new astronomy records are built, run `node tools/prepare/prepare-solar-geometry.mts`
before preparing their surfaces. The shared transport refresh helper is only
needed when the binding format changes; ordinary additions prepare their own body.

The extraction samples the analytical ellipsoid on a 5° longitude/latitude
grid. The existing terrestrial recipe and meshoptimizer reduce its 5,040
triangles to 480 native PolyCSS `u` raster triangles. The normal grid marks
unmapped terrain. Source uncertainties and assumed dimensions belong to each
body's source account, independently of this display simplification.

## Checks

[Validation helpers](../../../audits/distant-worlds/README.md) check package
closure, fresh source and runtime installation, radial surface deviation and
browser behavior. New reports go into ignored `output/`; the body README links
the evidence for its current sources and interpretation.
