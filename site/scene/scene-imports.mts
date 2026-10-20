import { queuedImport } from '../browser/import-queue.mts';

export const importSceneRegistry = queuedImport(() => import('./scene-registry.mts'));

/** The body runtime, shared by the startup prestart and the object directory. */
export const importPackagedObjectRuntime = queuedImport(() => import('./packaged-object-runtime.mts'));

/** Host controls are fetched only for a validated, framed bridge URL. */
export const importEmbedBridge = queuedImport(() => import('./embed-bridge.mts'));
