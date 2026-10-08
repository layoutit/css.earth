// `@cssearth/objects/node` (Node only): source manifests, which read and walk an object's source tree, the portable
// relative-path check their entries pass, preparation's read of the application registry from the prepared
// catalogue and of the catalogue and context descriptors in the object folders it is prepared from, and the runtime asset
// closure: each object's inventory of baked files, which the bake writes, setup
// restores and the build assembles. Nothing in the main entry imports this one.
export { assertRangeResponse, assertSourceRange, createSourceManifest, rangeRequestHeader, validateSourceManifest,
  verifySourceManifest } from './source-manifest.js';
export type { SourceEntry, SourceInput, SourceManifest, SourceManifestLocation, SourceRange, SourceVerification } from './source-manifest.js';
export { safeRelativePath } from './source-path.js';
export { PREPARED_CATALOGUE, preparedCatalogueModule, readPreparedObjects } from './prepared-registry.js';
export type { PreparedNavigableObject, PreparedObjectRegistry, PreparedSceneObject } from './prepared-registry.js';
export { readCatalog, readContextObjects, readObjectDescriptors, type ObjectDescriptors } from './catalog-directory.js';
export { ASSET_LOCATIONS, INVENTORY_FILE, INVENTORY_SCHEMA, assembleRuntimeAssetClosure, bakedPreparedFiles, inventoryPreparedAssets, inventoryPreparedSubset,
  inventoryPublicAssets, inventoryText, mergeInventory, normalizeRuntimeAssetUrls, readInventory,
  requireInventory, updateInventory, validateInventory, verifyInventory } from './runtime-asset-closure.js';
export type { AssetLocation, Inventory, InventoryAsset } from './runtime-asset-closure.js';
export { DELIVERED_PREPARED_RECORDS, SCENE_RETAINING_SOURCES, WORKING_PREPARED_RECORDS, deliveredPreparedFiles, deliveredPreparedRecord, isWorkingPreparedFile, retainsPreparedScene } from './prepared-delivery.js';
export type { DeliveredPreparedRecord, PreparedDeliveryContext, PreparedReader, WorkingPreparedRecord } from './prepared-delivery.js';
export { preparedObjectText, preparedObjectTransport, preparedPageData, readJsonHead, readPreparedControls } from './prepared-transport.js';
export { LEAF_BOXES_FILE, joinPreparedRuntimeText, readPreparedRuntimeText, splitPreparedRuntimeText, storePreparedRuntime } from './prepared-runtime-files.js';
export { packPreparedBinary, unpackPreparedBinary, packPreparedBank, unpackPreparedBank } from './prepared-binary-file.js';
export { volumeDatasetBankFiles, writeVolumeDatasetBank, readVolumeDatasetBank } from './volume-dataset-bank.js';
