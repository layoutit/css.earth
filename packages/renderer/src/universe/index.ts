// Application surroundings deliberately exclude detailed-object mounting and native input owners.
export { createPreparedUniverse } from './prepared-universe-runtime.js';
export { imageFocusDatasets } from './prepared-focus-bank.js';
export { parseLensBillboards } from './lens-billboards.js';
export { createWorldFrameQueue } from '../navigation/world-frame-queue.js';
export type { QueuedRequest } from '../navigation/world-frame-queue.js';
export { loadPreparedCssVolume } from '../volume/loader.js';
export { loadPreparedPointAppearance } from '../stars/loader.js';
export { loadPreparedCssSurfaceShell } from '../shell/loader.js';
export { loadPreparedCssImageLayers } from '../image-layers/loader.js';
export { createPreparedVolumeLenses, loadPreparedVolumeLenses, validatePreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
export type { PreparedVolumeLenses, PreparedVolumeLensBank, PreparedVolumeLens, PreparedVolumeLensBrightness,
  PreparedVolumeLensState, PreparedPointVisibility } from '../volume/prepared-volume-lenses.js';
export { mountPreparedCataloguePoints, validatePreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
export type { PreparedCataloguePoints, PreparedCataloguePoint } from '../stars/prepared-catalogue-points.js';
export { prepareObjectResources } from '../runtime/prepared-resource-lease.js';
export { createRetainedGeometrySnapshot } from '../rendering/retained-leaf-pool.js';

export type { WorldContextView, WorldBodyPresentation } from './world-context/world-context-planner.js';
