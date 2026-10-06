import { queuedImport } from '../browser/import-queue.mts';

/** The router, imported once through the application's shared queue. */
export const importSceneRouter = queuedImport(() => import('../scene/scene-router.mts'));
