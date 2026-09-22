// Internal test entry point. Exercises the same implementations used by the
// runtime bundle without importing the retired JavaScript runtime.
export * from './rendering/prepared-playback.js';
export * from './rendering/prepared-residency.js';
export * from './rendering/prepared-image-store.js';
export * from './rendering/object-control-binding.js';
export * from './rendering/object-selection-runtime.js';
export * from './rendering/prepared-presentation.js';
export * from './rendering/prepared-material.js';
export * from './rendering/prepared-material-demand.js';
export * from './runtime/object-contract.js';
export { createObjectViewDemand } from './runtime/prepared-object-navigation.js';
export * from './prepared-data/prepared-ellipsoid-projection.js';
export { publishObjectDiagnostics, readObjectDiagnostics } from './runtime/object-diagnostics.js';


