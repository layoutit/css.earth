// Application surroundings deliberately exclude detailed-object mounting and native input owners.
export { createPreparedUniverse } from './prepared-universe-runtime.js';
export { loadPreparedCssVolume } from '../volume/loader.js';
export { loadPreparedCssPointField } from '../stars/loader.js';
export { loadPreparedCssSurfaceShell } from '../shell/loader.js';
export { loadPreparedCssImageLayers } from '../image-layers/loader.js';
export { prepareObjectResources } from '../runtime/prepared-resource-lease.js';
