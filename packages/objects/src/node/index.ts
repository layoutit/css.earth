// `@cssearth/objects/node` (Node only): source manifests, which read and walk an object's source tree, and the portable
// relative-path check their entries pass. Nothing in the main entry imports this one.
export { SOURCE_MANIFEST_SCHEMA, assertRangeResponse, assertSourceRange, createSourceManifest, rangeRequestHeader, validateSourceManifest,
  verifySourceManifest } from './source-manifest.js';
export type { SourceEntry, SourceInput, SourceManifest, SourceManifestLocation, SourceRange, SourceVerification } from './source-manifest.js';
export { safeRelativePath } from './source-path.js';
