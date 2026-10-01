import { parseSharedView } from '@cssearth/renderer/navigation/view-url.ts';
import { savedWorldCamera } from '@cssearth/renderer/navigation';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPreparedCssObject } from '@cssearth/renderer';
import { createPreparedObjectNavigation } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
import { selectPreparedTextureLevel } from '@cssearth/renderer/rendering/prepared-texture-levels.ts';
import { presentWorldCamera } from '@cssearth/renderer/navigation';
import { readPreparedObjectBytes } from '../object-page-data.mts';
import { requireSceneObject } from '../objects.mts';
import { usesDefaultStartupView, readStartupSavedView } from '../startup-billboard.mts';
import { canUseArrivalBillboard } from '../arrival-billboard.mts';

test('default startup never overwrites a saved camera, dataset or context', () => {
  assert.equal(usesDefaultStartupView('https://css.earth/earth/', 'earth'), true);
  assert.equal(usesDefaultStartupView('https://css.earth/', 'earth'), true);
  assert.equal(usesDefaultStartupView('https://css.earth/earth/?embed', 'earth'), true);
  for (const key of ['v', 'dataset', 'feature', 'view', 'overview', 'settings'])
    assert.equal(usesDefaultStartupView(`https://css.earth/earth/?${key}=custom`, 'earth'), false, key);
  assert.equal(usesDefaultStartupView('https://css.earth/m31/', 'sun'), false, 'a catalogue focus page');
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
    // The level its own size asks for, never a cheaper stand-in: the billboard covers the load.
    const sized = definition.textureLevels.levels.findLastIndex(level => level.minimumDiameter <= diameter);
    assert.equal(selectPreparedTextureLevel(definition.textureLevels, diameter, undefined), sized,
      'the initial detailed scene demands viewport-sized textures');
  }
});

 test('saved startup prepares the saved camera and dataset instead of default arrival demand', async () => {
  const object = requireSceneObject('earth');
  const { descriptor, bytes } = await readPreparedObjectBytes('earth');
  const definition = await loadPreparedCssObject(descriptor, { async read() { return Uint8Array.from(bytes).buffer; } });
  const nav = createPreparedObjectNavigation(async () => definition, object.worldFrame);
  const saved = parseSharedView('v=UcO-LVLcltOqqz4XrhR64UeuwOjqIxJul5dBQsczQAAAAEAFN-vvz-Gxv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAA');
  assert.ok(saved);
  const query = 'v=UcO-LVLcltOqqz4XrhR64UeuwOjqIxJul5dBQsczQAAAAEAFN-vvz-Gxv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAA';
  assert.deepEqual(readStartupSavedView(`https://css.earth/earth/?${query}`), saved);
  assert.deepEqual(readStartupSavedView('https://css.earth/earth/', query.slice(2)), saved);
  // A page URL carries more than the camera: the overview, focus and dataset links start, with or without a saved camera.
  assert.deepEqual(readStartupSavedView(`https://css.earth/milky-way/?${query}`), saved);
  for (const page of ['https://css.earth/local-group/', 'https://css.earth/m31/', 'https://css.earth/mars/?dataset=albedo', 'https://css.earth/earth/']) {
    assert.equal(readStartupSavedView(page), null, page);
  }
  const viewport = { read: () => ({ bounds: { x: 0, y: 0, left: 0, top: 0, width: 820, height: 1180 }, focalPixels: 900,
    previewTop: 885, openArea: { top: 0, bottom: 885 } }), subscribe: () => () => {}, destroy() {} };
  const view = await nav.initialView(viewport, true, { saved }, new AbortController().signal);
  assert.deepEqual(view.world, savedWorldCamera(saved, object.worldFrame, { focalPixels: 900, principalOffsetPixels: [0, 0] }));
  assert.equal(view.viewport.focalPixels, 900 * (saved.camera.projectionScale ?? 1));
  assert.equal(view.viewport.widthPixels, 820);
  assert.equal(view.viewport.heightPixels, 1180);
});

test('an unreadable saved view opens the default view instead of failing the mount', () => {
  for (const value of ['garbage', 'UcM-', '']) assert.equal(readStartupSavedView(`https://css.earth/earth/?v=${value}`), null, value);
  assert.equal(readStartupSavedView('https://css.earth/earth/', 'garbage'), null);
  assert.equal(readStartupSavedView('https://css.earth/earth/'), null);
});
