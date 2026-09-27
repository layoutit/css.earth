// `@cssearth/bake/objects/provenance` (Node only): the record readers and product bindings of a layered body's provenance.
// The validated record, manifest and source-entry readers, and the recipe bindings that name each prepared product's inputs,
// recipe and outputs by preparation family; `tools/objects/provenance.mts` compiles an object's record from them. It imports
// `objects/layers/terrestrial`.
export * from './provenance-records.ts';
export * from './provenance-recipes.ts';
