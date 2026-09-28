// `@cssearth/bake/objects/acquisition` (Node only): the converters a body's acquisition plan runs to restore a derived source
// from its pinned original: a SPICE DSK to a welded mesh archive (through `dsk-mesh.py`), GeoTIFF numeric grids and images
// read by byte range, gzipped mapped-composition fits to GeoTIFF grids, and the JPL satellite catalogue. The Python
// converters beside them are run by hand from the body manifests' reproduction notes (`MAPPED-SCIENCE.md`,
// `DSK-RESTORATION.md`). `operations-acquisition.ts` runs a body's acquisition plan (`source/preparation/acquisition.json`):
// its downloads, derived-source converters and checks, and the restore of missing pinned sources. It imports `raster` and
// `objects/sources`, and loads `objects/layers/terrestrial` and `objects/layers/observation` only for the steps that need them.
// `object-operations.ts` (`runOperations`) is a body's acquire, verify, runtime-manifest and assemble operations, with
// `delivery`; `packages/bake/cli/object-operations.mts` is their command. `restore-factsheet-evidence.ts` restores one missing
// document a factsheet cites, through its authored download operation.
export * from './dsk-mesh.ts';
export * from './geotiff-grid.ts';
export * from './diviner-gcp.ts';
export * from './geotiff-image.ts';
export * from './mapped-composition.ts';
export * from './satellite-catalog.ts';
export * from './operations-acquisition.ts';
export * from './object-operations.ts';
export * from './restore-factsheet-evidence.ts';
