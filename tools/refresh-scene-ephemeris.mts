// Re-publish the fixed-epoch body frames and inherited parent translations.
// Existing navigation preparation refreshes carriers, sky, sunlight and bindings;
// surface geometry and image inputs are reused without a new shape bake.
import { chromium } from 'playwright';
import { loadSceneEpochEphemeris } from '../packages/astronomy/tools/scene-ephemeris.mts';
import { SOLAR_GEOMETRY_EPOCH_JD_TT, BODY_ORBITS } from '../src/platform/solar-geometry.mts';
import { prepareObjectJson } from './prepare-object-json.mts';

const states = await loadSceneEpochEphemeris(SOLAR_GEOMETRY_EPOCH_JD_TT);
const ids = new Set(states.keys());
let previous: number;
do {
  previous = ids.size;
  for (const [id, orbit] of Object.entries(BODY_ORBITS)) if (orbit.centerBodyId && ids.has(orbit.centerBodyId)) ids.add(id);
} while (ids.size !== previous);
const browser = await chromium.launch({ headless: true });
try {
  for (const result of await prepareObjectJson([...ids], { browser })) console.log(JSON.stringify(result));
} finally { await browser.close(); }
