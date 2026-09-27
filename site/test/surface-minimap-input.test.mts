import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import type { BrowserWindow } from '../browser/browser-types.mts';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import { createSurfaceMinimap } from '../minimap/surface-minimap.mts';
import { loadSurfaceGeometry } from '../minimap/surface-geometry.mts';
import { directionOnMap } from '../minimap/surface-minimap-math.mts';
import { navigationFixture, unusedSharedView } from './navigation-test-values.mts';

test('minimap arrow keys use the current camera without publishing centre attributes or reading layout', async () => {
  await loadSurfaceGeometry();
  const { document, window } = parseHTML('<html><body><section id="drawer"><div id="map"></div></section></body></html>');
  const drawer = document.getElementById('drawer')!, map = document.getElementById('map')!;
  const axes = { prime: [0, 0, 1], east: [1, 0, 0], north: [0, 1, 0] } as const;
  map.dataset.surfaceMinimap = JSON.stringify({ ...axes, surfaceSelector: '#map', mapLeftEdgeLongitudeDeg: 0 });
  let world: WorldCameraPose = { referenceFrame: 'test', epochJdTt: 1,
    pose: { positionM: [0, 0, 4], orientationXyzw: [0, 0, 0, 1] } };
  let scheduled = 0, applied = 0;
  Object.assign(window, { requestAnimationFrame: () => ++scheduled, cancelAnimationFrame() {} });
  map.getBoundingClientRect = () => { throw new Error('Keyboard navigation must use the camera viewport.'); };
  const navigation = navigationFixture({ referenceFrame: 'test', epochJdTt: 1, originM: [0, 0, 0],
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 },
    () => world, () => ({ focalPixels: 400, principalOffsetPixels: [0, 0], framingRadiusPixels: 100,
      detailHandoffDiameterPixels: 100, visibleRect: { left: -400, right: 400, top: -300, bottom: 300 } }));
  navigation.apply = next => {
    assert.ok(next.pose.positionM.every(Number.isFinite));
    assert.ok(next.pose.orientationXyzw.every(Number.isFinite));
    world = next; applied++;
  };
  const controller = createSurfaceMinimap({ drawer, documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    onInteraction() {}, surfaceReader: {
      read: () => ({ world, relative: world.pose.positionM, axes, scene: map, mapLeftEdgeLongitudeDeg: 0 }), reset() {}, destroy() {},
    } });
  controller.setCamera({ navigation, sharedView: unusedSharedView });
  const key = (name: string) => {
    const event = new window.Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: name });
    map.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  };
  try {
    key('ArrowRight');
    assert.equal(applied, 1);
    assert.ok(Math.abs(directionOnMap(world.pose.positionM, axes).u - .02) < 1e-9);
    key('ArrowRight');
    assert.equal(applied, 2);
    assert.ok(Math.abs(directionOnMap(world.pose.positionM, axes).u - .04) < 1e-9, 'the next key uses the changed camera');
    assert.ok(Math.abs(Math.hypot(...world.pose.positionM) - 4) < 1e-9, 'orbit distance is preserved');
    assert.equal(map.hasAttribute('data-center-u'), false);
    assert.equal(map.hasAttribute('data-center-v'), false);
  } finally { controller.destroy(); }
});
