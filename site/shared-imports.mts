import { importPackagedObjectRuntime, queuedImport } from './import-queue.mts';

/** The router, the registry and the world's code, each imported once and one at a time (`import-queue.mts`). */
export const importSceneRouter = queuedImport(() => import('./scene/scene-router.mts'));
export const importSceneRegistry = queuedImport(() => import('./scene/scene-registry.mts'));
export const importApplicationWorld = queuedImport(() => import('./application-world-context.mts'));
export { importPackagedObjectRuntime };
