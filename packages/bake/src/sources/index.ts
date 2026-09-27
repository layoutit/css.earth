// `@cssearth/bake/sources` (Node only): source records preparation reads beside an object. An object's authored
// descriptor (`object.json`, when it names a recipe), the independent records of the source catalogue (`src/sources/`),
// the authored physical world frame checked against a prepared scene and runtime, and the images embedded in a
// published PDF figure; the factsheet source checks, the object-information source records and the pinned-fact
// citations. It imports `runtime-source` and `objects/content`.
export * from './authored-object.ts';
export * from './authored-world-frame.ts';
export * from './cite-pinned-facts.ts';
export * from './factsheet-sources.ts';
export * from './object-information-sources.ts';
export * from './pdf-image.ts';
export * from './read-source-catalogue.ts';
