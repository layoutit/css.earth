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
3. To repeat the initial numerical extraction instead, run
   `python3 tools/objects/source-authoring/distant-worlds/author.py`.
   It uses the retained inputs and original template revision, and **resets
   all nine descriptors and source recipes**. Follow it with
   `node tools/objects/source-authoring/distant-worlds/finalize-sources.mjs`
   and preparation of each body. It leaves maintained READMEs and credits alone.
4. If the registry or marker sources change, use the shared
   `pnpm prepare:navigation` owner, then
   `node tools/objects/source-authoring/distant-worlds/refresh-transports.mjs`
   to bind the resulting atlas and refresh world contexts. This helper asserts
   that every non-marker runtime field remains unchanged and does not compile
   existing body presentations.
5. Install published runtime assets with `pnpm setup:assets --object=<id>`.

`register.py` repeats the original additions through the shared registry,
astronomy catalog and Sun navigation data. It is unnecessary for an existing
registered body. `finalize-sources.mjs --refresh-pins` only refreshes source
pins; omitting that flag also prepares title and context source images.

The extraction samples the analytical ellipsoid on a 5° longitude/latitude
grid. The existing terrestrial recipe and meshoptimizer reduce its 5,040
triangles to 480 native PolyCSS `u` raster triangles. The normal grid marks
unmapped terrain. Source uncertainties and assumed dimensions belong to each
body's source account, independently of this display simplification.

## Qualification tools and prior evidence

[Validation helpers](../../../audits/distant-worlds/README.md) check package
closure, fresh source and runtime installation, radial surface deviation and
actual browser behavior. New reports go into ignored `output/`.

The original preparation, browser and source reports remain at
[revision 5ccf1eafa](https://github.com/layoutit/cssEarth/tree/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds).
Their recorded paths, timestamps, bytes and failures are unchanged. The body
READMEs link the individual reports and explain their applicability. Moving
the helper files and consolidating documentation does not requalify rendering;
reuse rests on unchanged source, prepared data and shared runtime dependencies.

The initial marker-preservation experiment used the historical
[navigation helper](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/lucy-targets/navigation.mjs)
against its recorded base. Use the maintained shared navigation preparer for
future atlas changes, rather than depending on that historical experiment.
