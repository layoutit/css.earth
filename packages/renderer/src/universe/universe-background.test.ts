import { expect, test } from 'vitest';
import { faceOnImpostorView } from './universe-background.js';
import { projectVolumeImpostors } from '../volume/volume-impostor-projection.js';
import type { PreparedCssVolume, PreparedVolumeImpostors } from '../volume/types.js';

// A disc: thin along y, so its face-on view looks down y.
const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-10, -1, -10] as const, max: [10, 1, 10] as const } };
const impostors: PreparedVolumeImpostors = { schema: 'cssearth-volume-impostors@1', radiusUnits: 10, fullBelowDiameterPixels: 128, volumeAboveDiameterPixels: 256,
  views: [
    { id: 'edge', back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0], texturePath: 'edge.png' },
    { id: 'north', back: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1], texturePath: 'north.png' },
    { id: 'south', back: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1], texturePath: 'south.png' },
  ] };

test('a galaxy seen from outside is its one face-on view, turned to face the camera from any direction', () => {
  const view = faceOnImpostorView({ frame, impostors } as unknown as PreparedCssVolume);
  expect(view, 'the view down the disc normal').toBe('north');
  const single = { ...impostors, views: impostors.views.filter(candidate => candidate.id === view) };
  // Nearly edge-on, where the blended views superimposed a streak on a disc, the one view still draws alone at full weight.
  const projection = projectVolumeImpostors({ world: { referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 1, 100], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 } }, frame, single);
  expect(projection.views.map(entry => [entry.id, entry.weight])).toEqual([['north', 1]]);
});
