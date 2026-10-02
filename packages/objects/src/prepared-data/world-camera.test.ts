import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePreparedWorldCamera, worldCameraOf } from './world-camera.js';
import { parsePreparedWorldCameraFrame } from './world-frame.js';

const frame = { referenceFrame: 'ICRF', epochJdTt: 2451545, originM: [0, 0, 0],
  presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 };
const presentation = {
  projection: { model: 'css-perspective-shared-with-sky', cssPerspective: '1000px' },
  dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .001, minimumDistanceRadii: 2, maximumDistanceOverOrbitExtent: 4 },
  levelOfDetail: { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 100,
    billboardFullDiscPixels: 50, markerFadeStartDiscPixels: 10, markerFullDiscPixels: 2 },
  orbitLineFade: { visibleBelowDiscHeightShare: .1, hiddenAboveDiscHeightShare: .2 },
  drag: { model: 'screen-axis-tumble' },
};
const camera = { minimumDistanceM: 2, maximumDistanceM: 100, framingReferenceZoom: 1, presentation };
const record = () => worldCameraOf({ frame, focus: { id: 'focus' }, camera });

test('world camera serialization and frame validation preserve the shared transport', () => {
  assert.equal(record().schema, 'cssearth-world-camera@1');
  const parsed = parsePreparedWorldCamera(record());
  assert.deepEqual(parsed, { frame, focusId: 'focus', camera });
  assert(Object.isFrozen(parsed.camera.presentation.dolly));
  assert.equal(parsePreparedWorldCameraFrame(null), null);
  assert.throws(() => parsePreparedWorldCamera({ ...record(), frame: null }), /requires its prepared frame/);
  assert.throws(() => parsePreparedWorldCamera({ ...record(), focusId: 'Invalid' }), /Invalid world camera focus identity/);
  assert.throws(() => parsePreparedWorldCamera({ ...record(), schema: 'unknown' }), /Unsupported world camera: unknown\./);
});

test('world camera rejects handedness, malformed frames and unordered distances', () => {
  assert.throws(() => parsePreparedWorldCameraFrame({ ...frame, presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1] }), /must reverse handedness/);
  assert.throws(() => parsePreparedWorldCameraFrame({ ...frame, metersPerUnit: 0 }), /positive/);
  assert.throws(() => parsePreparedWorldCameraFrame({ ...frame, orbitUpReference: [0, 0, 2] }), /Orbit up must be a unit vector\./);
  assert.throws(() => parsePreparedWorldCamera({ ...record(), camera: { ...camera, maximumDistanceM: 2 } }), /World camera distance interval is invalid\./);
});

test('presentation retains the stricter descending thresholds and outside-focus dolly policy', () => {
  const check = (changed: typeof presentation) => parsePreparedWorldCamera({ ...record(), camera: { ...camera, presentation: changed } });
  assert.throws(() => check({ ...presentation, dolly: { ...presentation.dolly, minimumDistanceRadii: 1 } }), /must remain outside the focus/);
  assert.throws(() => check({ ...presentation, levelOfDetail: { ...presentation.levelOfDetail, markerFadeStartDiscPixels: 60 } }), /thresholds must descend/);
  assert.throws(() => check({ ...presentation, orbitLineFade: { visibleBelowDiscHeightShare: .2, hiddenAboveDiscHeightShare: .1 } }), /fade bounds are invalid/);
});
