// Application surroundings deliberately exclude detailed-object mounting and native input owners.
export { createPreparedUniverse } from './prepared-universe-runtime.js';
export { prestartWorldContextPlanner } from './world-context/world-context-planner-client.js';
export { imageFocusDatasets } from './prepared-focus-bank.js';
export { createWorldFrameQueue } from '../navigation/world-frame-queue.js';
export type { QueuedRequest } from '../navigation/world-frame-queue.js';
export { loadPreparedCssVolume } from '../volume/loader.js';
export { loadPreparedPointAppearance } from '../stars/loader.js';
export { loadPreparedCssSurfaceShell } from '../shell/loader.js';
export { loadPreparedCssImageLayers } from '../image-layers/loader.js';
export { createPreparedVolumeDatasets, loadPreparedVolumeDatasets } from '../volume/prepared-volume-datasets.js';
export type { PreparedVolumeDatasetState } from '../volume/prepared-volume-datasets.js';
export { mountPreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';

export { prepareObjectResources } from '../runtime/prepared-resource-lease.js';
export { createRetainedGeometrySnapshot } from '../rendering/retained-leaf-pool.js';

export type { WorldContextView, WorldBodyPresentation } from './world-context/world-context-planner.js';
