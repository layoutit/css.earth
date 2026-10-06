import { queuedImport } from '../browser/import-queue.mts';

export const importApplicationWorld = queuedImport(() => import('./application-world-context.mts'));
