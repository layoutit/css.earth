// `@cssearth/bake/sources` (Node only): source records preparation reads beside an object. An object's authored
// descriptor (`object.json`, when it names a recipe), the independent records of the source catalogue (`src/sources/`),
// the authored physical world frame checked against a prepared scene and runtime, and the images embedded in a
// published PDF figure; the factsheet source checks, the object-information source records and the pinned-fact
// citations; the source records a context manifest lists, the factsheet citations and source inventory the source
// catalogue compiles, the bibliography citations of the prepared galaxy and cluster catalogues, and the digest that
// says whether a recorded preparation still applies to a provenance record; the context packages' provenance, compiled
// from their manifests or read as installed, at the application route passed in; the facility artwork refresh, which
// swaps model-render bytes under unchanged attribution; and the investigation ledgers beside each object and facility,
// the shared investigation surveys they quote (`data/investigations/`) and the report over them
// (`packages/bake/cli/report-investigations.mts`). It imports `runtime-source`, `objects/content` and `delivery`.
export * from './authored-object.ts';
export * from './authored-world-frame.ts';
export * from './cite-pinned-facts.ts';
export * from './context-source-records.ts';
export * from './facility-artwork-refresh.ts';
export * from './factsheet-sources.ts';
export * from './investigation-ledger.ts';
export * from './investigation-report.ts';
export * from './investigation-survey.ts';
export * from './object-information-sources.ts';
export * from './pdf-image.ts';
export * from './preparation-evidence.ts';
export * from './prepare-context-provenance.ts';
export * from './read-prepared-context-provenance.ts';
export * from './read-source-catalogue.ts';
export * from './source-catalogue-inputs.ts';
export * from './spatial-source-citations.ts';
