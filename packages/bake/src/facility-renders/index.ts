// `@cssearth/bake/facility-renders` (Node only): the illustrative poses of the rendered facility models. The renderer itself
// (`render.ts`, three.js in a browser page) is bundled from its source by `packages/bake/cli/prepare-facility-renders.mts`; only its
// types are exported here. It imports no topic.
export * from './poses.ts';
export type { RenderRequest, recipe, renderFacility } from './render.ts';
