// `@cssearth/bake/sources` (Node only): source records preparation reads beside an object. An object's authored
// descriptor (`object.json`, when it names a recipe), the independent records of the source catalogue (`src/sources/`),
// the authored physical world frame checked against a prepared scene and runtime, and the images embedded in a
// published PDF figure. It imports `runtime-source`.
export * from './authored-object.ts';
export * from './authored-world-frame.ts';
export * from './pdf-image.ts';
export * from './read-source-catalogue.ts';
