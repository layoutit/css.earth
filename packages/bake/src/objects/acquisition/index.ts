// `@cssearth/bake/objects/acquisition` (Node only): the converters a body's acquisition plan runs to restore a derived source
// from its pinned original: a SPICE DSK to a welded mesh archive (through `dsk-mesh.py`), GeoTIFF numeric grids and images
// read by byte range, gzipped mapped-composition fits to GeoTIFF grids, and the JPL satellite catalogue. The Python
// converters beside them are run by hand from the body manifests' reproduction notes (`MAPPED-SCIENCE.md`,
// `DSK-RESTORATION.md`).
export * from './dsk-mesh.ts';
export * from './geotiff-grid.ts';
export * from './diviner-gcp.ts';
export * from './geotiff-image.ts';
export * from './mapped-composition.ts';
export * from './satellite-catalog.ts';
