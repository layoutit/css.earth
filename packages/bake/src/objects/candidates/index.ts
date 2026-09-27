// `@cssearth/bake/objects/candidates` (Node only): what public archives hold for a body or a star before it is reworked.
// Read-only searches of ALMA, the ESO archive, MAST, DataCite and the JMMC diameters, each split into a query and a pure
// summary of its rows; the imagery candidates (OPUS frames finer than a body ships, and archive leads for a named body);
// and the resolved-star candidates (SIMBAD references, OiDB granules, VizieR deposits and the route that worked for the
// placed stars). `packages/bake/cli/imagery-candidates.mts` and `star-candidates.mts` print them. It imports no topic.
export * from './archive-search.ts';
export * from './imagery-candidates.ts';
export * from './star-candidates.ts';
