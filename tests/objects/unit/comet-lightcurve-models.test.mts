import { testLightcurveModel } from './comets/lightcurve-models.mts';
import { selectedObjectIds } from './anchor-table.mts';

// Independent source anchors: Donaldson (2025), Tables 4.3/4.4 and p.79.
// [a/b, b/c, mean radius km, pole longitude, pole latitude]
const MODELS = {
  'comet-137p': [1.06, 1.30, 4.04, 132.5, -56.5],
  'comet-143p': [1.21, 1.24, 4.79, 55.4, -58.3],
  'comet-162p': [1.6, 2.2, 7.03, 118, -50],
} as const;
for (const id of selectedObjectIds(Object.keys(MODELS))) {
  const [ab, bc, radius, longitude, latitude] = MODELS[id as keyof typeof MODELS];
  testLightcurveModel(id, ab, bc, radius, longitude, latitude);
}
