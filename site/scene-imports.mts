import { queuedImport } from './import-queue.mts';

export const importSceneRegistry = queuedImport(() => import('./scene/scene-registry.mts'));

/** The body runtime, shared by the startup prestart and the object directory. */
export const importPackagedObjectRuntime = queuedImport(() => import('./packaged-object-runtime.mts'));
