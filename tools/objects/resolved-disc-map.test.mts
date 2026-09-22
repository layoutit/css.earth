import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { placeResolvedDisc } from './resolved-disc-map.mts';

const size = 41, radius = 8, values = new Float64Array(size * size), uncertainty = new Float64Array(size * size).fill(0.02);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) values[y * size + x] = Math.hypot(x - 20, y - 20) <= radius ? 1 : 0;
const orientation = { rotation: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const, phaseDegrees: () => 0 };

test('one typed resolved-disc plane becomes a body map and complete observation', () => {
  const placed = placeResolvedDisc({ plane: { width: size, height: size, values, uncertainty, arcsecPerPixel: 0.1 },
    identity: { id: 'image-1', telescope: 'Example', instrument: 'Camera', mode: 'imaging', programme: 'program-1', midTimeJd: 2_451_545 },
    geometry: { epochJd: 2_451_545, targetRightAscensionDegrees: 0, targetDeclinationDegrees: 0, sunRightAscensionDegrees: 0,
      sunDeclinationDegrees: 0, rangeAu: 469.7 / 8 / 0.1 * 206_264.806_247 / 1.495978707e8 },
    orientation, radiusKm: 469.7, grid: { width: 72, height: 36 }, maximumEmissionDegrees: 70, minimumDiscPixels: 12 });
  assert.ok(Math.abs(placed.centre.center[0] - 20) < 0.1 && Math.abs(placed.centre.center[1] - 20) < 0.1);
  assert.ok(placed.map.seenCells > 0);
  assert.equal(placed.observation.mode, 'imaging');
  assert.equal(placed.observation.programme, 'program-1');
  assert.match(placed.observation.angularResolution.basis, /resolved limb/u);
});

test('the shared boundary refuses missing uncertainty and unresolved discs', () => {
  const base = { plane: { width: size, height: size, values, uncertainty, arcsecPerPixel: 0.1 },
    identity: { id: 'image-1', telescope: 'Example', instrument: 'Camera', mode: 'imaging', programme: 'program-1', midTimeJd: 2_451_545 },
    geometry: { epochJd: 2_451_545, targetRightAscensionDegrees: 0, targetDeclinationDegrees: 0, sunRightAscensionDegrees: 0,
      sunDeclinationDegrees: 0, rangeAu: 469.7 / 8 / 0.1 * 206_264.806_247 / 1.495978707e8 },
    orientation, radiusKm: 469.7, grid: { width: 72, height: 36 }, maximumEmissionDegrees: 70 };
  assert.throws(() => placeResolvedDisc({ ...base, plane: { ...base.plane, uncertainty: new Float64Array(0) } }), /matching/u);
  assert.throws(() => placeResolvedDisc({ ...base, plane: { ...base.plane, registrationValues: new Float64Array(0) } }), /matching/u);
  assert.throws(() => placeResolvedDisc({ ...base, minimumDiscPixels: 20 }), /below/u);
});
