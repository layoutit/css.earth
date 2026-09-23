import type { createPreparedUniverse } from '../src/renderers/css/dist/universe.js';
import type { mountCatalogueMoonLabels } from './catalogue-moon-labels.mts';

type PreparedUniverse = ReturnType<typeof createPreparedUniverse>;
export type ApplicationWorldLayer = ReturnType<PreparedUniverse['mount']>;
export type ApplicationWorldPlanner = ReturnType<PreparedUniverse['createFramePlanner']>;
export type ApplicationWorldMoonLabels = ReturnType<typeof mountCatalogueMoonLabels>;
