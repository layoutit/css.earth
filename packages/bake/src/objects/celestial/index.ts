// `@cssearth/bake/objects/celestial` (Node only): an object's sky orientation and directional Sun, prepared into
// renderer-neutral JSON from its celestial profile and the solar geometry the host passes in. A topic of its own, outside
// `objects/scene`, whose code the nebula lab's compiler identity reaches.
export * from './celestial.ts';
export type { SolarSource, StarfieldPlan, SunPlan } from './adapters.ts';
