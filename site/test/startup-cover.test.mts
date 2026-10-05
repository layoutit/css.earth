import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPreparedCssObject } from '@cssearth/renderer';
import { createPreparedObjectNavigation } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
import { presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import { billboardBodyRadiusPixels } from '@cssearth/renderer/navigation/prepared-body-billboards.ts';
import { readPreparedObjectBytes } from '../server/object-page-data.mts';
import { requireObject } from '../objects.mts';
import { parseStartupCover, startupCoverPlacement } from '../startup/startup-cover.mts';
import { loadPreparedSceneMarkup } from '../server/load-prepared-scene.mts';

test('the baked cover places the photograph where the scene publishes it', async () => {
  const object = requireObject('earth'), arrival = object.discovery.arrival;
  assert.ok(arrival?.billboard);
  const { descriptor, bytes } = await readPreparedObjectBytes('earth');
  const definition = await loadPreparedCssObject(descriptor, { async read() { return Uint8Array.from(bytes).buffer; } });
  const nav = createPreparedObjectNavigation(async () => definition, object.worldFrame);
  const { coverPlan } = await loadPreparedSceneMarkup('earth');
  // What ObjectLayout.astro bakes, through JSON as the page carries it.
  const cover = parseStartupCover(JSON.parse(JSON.stringify({ plan: coverPlan, mobileQuery: '(orientation: portrait)',
    billboard: arrival.billboard, bodyRadiusM: object.worldFrame.bodyRadiusM })));
  assert.ok(cover);
  for (const [width, height, mobile] of [[390, 844, true], [820, 1180, true], [1180, 820, false], [1440, 900, false]] as const) {
    const viewport = { read: () => ({ bounds: { x: 0, y: 0, left: 0, top: 0, width, height }, focalPixels: 900,
      previewTop: height * .75, openArea: mobile ? { top: 40, bottom: height * .75 } : null }), subscribe: () => () => {}, destroy() {} };
    const view = await nav.initialView(viewport, mobile, { rotation: arrival.rotation, distanceM: arrival.billboard.distanceM }, new AbortController().signal);
    const projection = presentWorldCamera(view.world, object.worldFrame, view.viewport), rect = view.viewport.visibleRect;
    // prepareArrivalBillboard's publish: scale by the projected silhouette, shift to the open area's centre.
    const scale: number = projection.silhouette!.tangentialSemiAxis / billboardBodyRadiusPixels(arrival.billboard, object.worldFrame.bodyRadiusM);
    const offsetY: number = projection.centerPixels![1] - (rect.top + rect.bottom) / 2;
    const placed = startupCoverPlacement(cover, viewport, mobile);
    assert.ok(Math.abs(placed.scale / scale - 1) < 1e-9, `${width}×${height} scale ${placed.scale} vs ${scale}`);
    assert.ok(Math.abs(placed.offsetY - offsetY) < 1e-6, `${width}×${height} offset ${placed.offsetY} vs ${offsetY}`);
    assert.ok(Math.abs(projection.centerPixels![0] - (rect.left + rect.right) / 2) < 1e-6, 'centred horizontally');
  }
});

test('a cover without its camera plan or optics is refused', () => {
  assert.equal(parseStartupCover(null), null);
  assert.equal(parseStartupCover({ mobileQuery: 'x', billboard: { size: 1, focalPixels: 1, distanceM: 2 }, bodyRadiusM: 1 }), null);
  assert.equal(parseStartupCover({ plan: { logicalBodyDiameter: 1, defaultZoom: 1, responsiveFit: {}, projection: { cssPerspective: '1px' } },
    mobileQuery: 'x', billboard: { size: 1, focalPixels: 1, distanceM: 0.5 }, bodyRadiusM: 1 }), null, 'a camera inside the body');
});
