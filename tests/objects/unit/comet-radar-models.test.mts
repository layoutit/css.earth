import { testRadarApproximation } from './comets/radar-models.mts';
import { selectedObjectIds } from './anchor-table.mts';

// Published absolute semiaxes in metres.
const MODELS: Readonly<Record<string, readonly number[]>> = {
  // Schleicher & Knight (2016), section 2.2: 3.9 x 2.7 x 2.6 km full dimensions.
  'comet-209p': [1950, 1350, 1300],
  // Harmon & Nolan (2005), Table 3, SAM1 and eta=2.60. Table a is a semiaxis.
  'comet-2p': [4580, 4580 / 2.60, 4580 / 2.60],
};
for (const id of selectedObjectIds(Object.keys(MODELS))) testRadarApproximation(id, MODELS[id]);
