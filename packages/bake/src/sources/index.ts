// `@cssearth/bake/sources` (Node only): source records preparation reads beside an object. An object's authored
// descriptor (`object.json`, when it names a recipe), the independent records of the source catalogue (`src/sources/`),
// the authored physical world frame checked against a prepared scene and runtime, and the images embedded in a
// published PDF figure; binding an object's manifest inputs to catalogue records (`author-source-records.ts`, whose command
// `site/build/prepare/catalog/author-source-records.mts` also rewrites volume presentations); the factsheet source checks, the object-information source records and their snapshots (`prepare-object-information.ts`) and the pinned-fact
// citations; the source records a context manifest lists, the factsheet citations and source inventory the source
// catalogue compiles, and the bibliography citations of the prepared galaxy and cluster catalogues; the context packages'
// lineage, read from their manifests and source presentations, at the application route passed in; the facility artwork refresh, which
// swaps model-render bytes under unchanged attribution; and the investigation ledgers beside each object and facility,
// the shared investigation surveys they quote (`src/sources/investigations/`) and the report over them
// (`packages/bake/cli/report-investigations.mts`); and the lookups of what a source manifest declares and of a value in an object's JSON records (`packages/bake/cli/lookup/index.mts manifest` and `records`).
// The astronomy data audit ledger (`astronomy-data/`, documented at
// `src/sources/astronomy-data/README.md`) is its own bundle, `@cssearth/bake/sources/astronomy-data`: its `model.ts`
// loads `node:sqlite`, which prints an experimental-feature warning on import, and this barrel must stay silent for
// every caller that only needs the exports below. It imports `runtime-source`, `objects/content` and `delivery`.
export * from './authored-object.ts';
export * from './authored-world-frame.ts';
export * from './author-source-records.ts';
export * from './cite-pinned-facts.ts';
export * from './context-source-records.ts';
export * from './facility-artwork-refresh.ts';
export * from './factsheet-sources.ts';
export * from './investigation-ledger.ts';
export * from './investigation-report.ts';
export * from './investigation-survey.ts';
export * from './manifest-lookup.ts';
export * from './object-information-sources.ts';
export * from './pdf-image.ts';
export * from './prepare-object-information.ts';
export * from './read-source-catalogue.ts';
export * from './record-lookup.ts';
export * from './source-catalogue-inputs.ts';
export * from './spatial-source-citations.ts';
