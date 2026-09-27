// `@cssearth/bake/galaxy-field` (Node only): the nearby-universe galaxy point field. The pinned VizieR catalogue acquisition
// (a cached copy, the project's source mirror, then the recorded query), the scientific catalogue read into positions and
// distances, the authored field recipe, and the smoothed galaxy-count clouds fitted to the points. The field's bake is the
// command `packages/bake/cli/prepare-galaxy-field-points.mts`. It imports `objects/sources`.
export * from './acquire.ts';
export * from './catalogue.ts';
export * from './cloud-fit.ts';
export * from './recipe.ts';
