import { queuedImport } from './import-queue.mts';

/** The router, imported once through the application's shared queue. */
export const importSceneRouter = queuedImport(() => import('./scene/scene-router.mts'));
