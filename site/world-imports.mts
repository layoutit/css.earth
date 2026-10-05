import { queuedImport } from './import-queue.mts';

export const importApplicationWorld = queuedImport(() => import('./application-world-context.mts'));
