// `@cssearth/objects/node` (Node only): source manifests, which read and walk an object's source tree, the portable
// relative-path check their entries pass, and preparation's read of the application registry from the prepared
// catalogue. Nothing in the main entry imports this one.
export { SOURCE_MANIFEST_SCHEMA, assertRangeResponse, assertSourceRange, createSourceManifest, rangeRequestHeader, validateSourceManifest,
  verifySourceManifest } from './source-manifest.js';
export type { SourceEntry, SourceInput, SourceManifest, SourceManifestLocation, SourceRange, SourceVerification } from './source-manifest.js';
export { safeRelativePath } from './source-path.js';
export { PREPARED_CATALOGUE, readPreparedObjects } from './prepared-registry.js';
export type { PreparedNavigableObject, PreparedObjectRegistry, PreparedSceneObject } from './prepared-registry.js';
