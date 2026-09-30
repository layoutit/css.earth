import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { hitsProjectedBody } from './world-camera-hit.js';
import { presentWorldCamera } from './world-camera.js';

it('near-surface off-axis picking follows forward sphere rays even when no bounded ellipse exists', () => {
  const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0] as const,
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 };
  const world = { referenceFrame: 'test', epochJdTt: 1,
    pose: { positionM: [-90,0,50] as const, orientationXyzw: [0,0,0,1] as const } };
  const viewport = { focalPixels: 1000, principalOffsetPixels: [-170,0] as const };
  const view = presentWorldCamera(world, frame, viewport);
  assert.equal(view.silhouette, null);
  const body = { visible: false, silhouette: null, translate: view.translateCssPixels } satisfies Parameters<typeof hitsProjectedBody>[2];
  const bounds = { x: 170, y: 0, width: 1440, height: 900 };
  const physical = { ...viewport, bodyRadiusUnits: frame.bodyRadiusM };
  // At the image's optical centre a forward ray intersects the near body.
  assert.equal(hitsProjectedBody(720, 450, body, bounds, null, physical), true);
  // The opposite side looks past its horizon into empty sky.
  assert.equal(hitsProjectedBody(0, 450, body, bounds, null, physical), false);
  const behind = { ...body, translate: [90,0,1100] as const };
  assert.equal(hitsProjectedBody(720, 450, behind, bounds, null, physical), false);
});
