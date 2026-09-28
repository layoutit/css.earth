import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPreparedCssObject } from '@cssearth/renderer';
import { createPreparedObjectNavigation } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
import { selectPreparedTextureLevel } from '@cssearth/renderer/rendering/prepared-texture-levels.ts';
import { presentWorldCamera } from '@cssearth/renderer/navigation';
import { readPreparedObjectBytes } from '../object-page-data.mts';
import { requireSceneObject } from '../objects.mts';
import { usesDefaultStartupView } from '../startup-billboard.mts';
import { canUseArrivalBillboard } from '../arrival-billboard.mts';

test('default startup never overwrites a saved camera, lens or context', () => {
  assert.equal(usesDefaultStartupView('https://css.earth/earth/'), true);
  assert.equal(usesDefaultStartupView('https://css.earth/earth/?embed'), true);
  for (const key of ['v', 'dataset', 'feature', 'focus', 'focusLens', 'view', 'overview', 'settings'])
    assert.equal(usesDefaultStartupView(`https://css.earth/earth/?${key}=custom`), false, key);
});

test('startup uses the baked perspective and viewport texture demand before mounting', async () => {
  const object = requireSceneObject('earth'), arrival = object.discovery.arrival;
  assert.ok(arrival?.billboard);
  const { descriptor, bytes } = await readPreparedObjectBytes('earth');
  const definition = await loadPreparedCssObject(descriptor, { async read() { return Uint8Array.from(bytes).buffer; } });
  const nav = createPreparedObjectNavigation(async () => definition, object.worldFrame);
  const signal = new AbortController().signal;
  for (const [width, height, mobile] of [[390, 844, true], [820, 1180, true], [1440, 900, false]] as const) {
    const viewport = { read: () => ({ bounds: { x: 0, y: 0, left: 0, top: 0, width, height }, focalPixels: 900,
      previewTop: height * .75, openArea: mobile ? { top: 0, bottom: height * .75 } : null }), subscribe: () => () => {}, destroy() {} };
    const view = await nav.initialView(viewport, mobile, { rotation: arrival.rotation, distanceM: arrival.billboard.distanceM }, signal);
    assert.ok(canUseArrivalBillboard(arrival, view.world, object.worldFrame, view.viewport));
    assert.ok(Math.abs(presentWorldCamera(view.world, object.worldFrame, view.viewport).distanceM - arrival.billboard.distanceM) < 1e-5);
    assert.ok(definition.textureLevels);
    const diameter = 2 * presentWorldCamera(view.world, object.worldFrame, view.viewport).silhouette!.tangentialSemiAxis;
    assert.ok(selectPreparedTextureLevel(definition.textureLevels, diameter, undefined) > 0,
      'the initial detailed scene demands viewport-sized textures');
  }
});
