# PR61 / B2 shared preparation merge

Reviewed base `e23a357b`, B2 `162ce08f94eae519bf1ca95d5672237fb4757ed0`, incoming main `4848897ee01d37987f837351802ec35ca3cd1871`. The only overlapping files are `index.mjs`, `observed-geotiff.mjs`, and `solid-raster.mjs` under `tools/objects/terrestrial-layers/`. The first and last conflict; GeoTIFF merges cleanly.

The final proposals are under `proposals/tools/objects/terrestrial-layers/`. Copy only the two conflicted files during the active merge; compare the clean GeoTIFF merge to its proposal. `shared-union-against-b2.patch` is a review patch against the premerge B2 files, not a patch to apply on top of an already resolved merge. File hashes and exact refs are in `inventory.json`.

- **index:** Union observation kinds with incoming `geotiff-rgb-bands` and `pds3-rgb-zip`, retaining B2 `pds4-float-rgb`. Keep the incoming explicit source grid, selected channels, alpha/storage, member and target validators. Retain B2 masked-GeoTIFF `source-georeferenced-bilinear` restrictions and PDS4 validation. All existing facet/category/scientific parsing stays unchanged. The new RGB-band kind uses its own source grid; do not give it the masked-GeoTIFF resampling option.
- **solid-raster:** Keep all three early decoders: B2 PDS4, incoming PDS3 RGB ZIP and incoming GeoTIFF RGB bands. All must run before generic Sharp metadata/byte assumptions. Keep B2 monochrome native-coordinate dispatch, source dependencies, facet source-row association, bounded preview grid, scientific nearest display, lossless category/numeric atlas and pole handling unchanged.
- **observed-geotiff:** Add incoming `prepareRgbBandObservation` and projected-byte helper import alongside B2's existing native-coordinate masked-observation implementation. Do not replace either path with the other. Incoming alpha validity happens before16-bit codes are reduced to display bytes; B2 native bilinear validity remains at nonzero contributors with exact source pixel-center handling.
- **incoming dependency closure:** Accept incoming `observed-image.mjs` export/raw-buffer/source-alpha support, `observed-pds-rgb.mjs`, and their tests. The projected-image validity now ignores zero-weight neighbors. This helper is separate from B2's native-coordinate GeoTIFF remapper. The currently authored B2 byte-image recipes do not set `validity.grid`, so they retain their existing branch; `b2-observation-dispatch.json` records the12 terrestrial body recipes. Moon uses its separate static preparation path.

A small textual proof removed only exact incoming insertions from the three proposals and recovered each original B2 file byte-for-byte. This proves narrow source preservation, not numerical/browser correctness. No checkout edits, source decodes, tests, builds or browser jobs were run by this lane.

## Focused checks after merge

Run serialized in the root scheduling slot:

```sh
node --test --test-concurrency=1 tools/objects/terrestrial-layers/{georeferenced-observation,observed-geotiff,observed-pds-rgb,observed-image,observed-pds4,categorical-solid-raster,facet-preview,scientific-focus}.test.mjs
```

These files contain27 static test declarations: actual B2 masked dispatch/native coordinates/footprints, incoming16-bit RGB/alpha identity and PDS3BSQ/crop, projected-byte defaults, PDS4, categorical/numeric nearest globe/poles, bounded facet previews/native-row invariants, and scientific focus. Counts are expected from source, not an executed pass.

Parse the12 B2 terrestrial profiles plus incoming Bennu/Eros/Vesta through the merged `parseTerrestrialProfile`; Moon's separate static path does not use that parser. Then use the planned preparation typecheck/build and required aggregate source/tests/build/browser gates on the final integrated head. No B2 body-science material change is indicated by this additive merge; determine capture reuse from final payload/CSS hashes rather than assuming old evidence is current. Incoming body packages retain their own main source/runtime evidence and should be included in the final source and generic browser gates.
