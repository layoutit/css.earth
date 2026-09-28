// `@cssearth/bake/objects/provenance` (Node only): the record readers and product bindings of a layered body's provenance.
// The validated record, manifest and source-entry readers, and the recipe bindings that name each prepared product's inputs,
// recipe and outputs by preparation family; and the compiler of an object's record from them (`object-provenance.ts`,
// `prepareObjectProvenance`). It imports `objects/layers/terrestrial` and `sources`, and loads `objects/acquisition` for the
// recipes whose inputs it reads; and the recovery of every scene body's record (`recover-provenance.ts`), written with
// `delivery`, beside the catalogue compilation the application passes in.
export * from './provenance-records.ts';
export * from './provenance-recipes.ts';
export * from './object-provenance.ts';
export * from './recover-provenance.ts';
