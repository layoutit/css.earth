export type { JsonValue, JsonRecord, ObjectDescriptor, PreparedAssetReference, PreparedObject } from './descriptor.js';
export { parseObjectDescriptor } from './parse.js';
export { parseAuthoredObjectDescriptor, parseAuthoredRecipe } from './authored.js';
export type { AuthoredObjectDescriptor, AuthoredRecipe, CutawayRecipe, DestinationsRecipe, FrameBankRecipe, LayerRecipe, LensRecipe, MaterialRecipe, MotionRecipe, PagingRecipe, ShapeKind, ShapeRecipe, SourceReference, SurfaceRecipe, WorldFrameRecipe } from './authored.js';
export * from './baking/index.js';
export * from './geometry/index.js';
export { prepareObject, readPreparedObject } from './preparation.js';
export type { ObjectPreparation } from './preparation.js';
