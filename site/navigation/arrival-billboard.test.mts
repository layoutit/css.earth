import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { type PreparedArrivalView } from '@cssearth/objects';
import { worldCameraFromCenteredPresentation } from '@cssearth/engine';
import { presentWorldCamera } from '@cssearth/renderer/navigation/camera/world-camera.ts';
import { prepareArrivalBillboard, canUseArrivalBillboard, frameArrivalBillboard } from './arrival-billboard.mts';

test('arrival fits every viewport at the exact prepared perspective', () => {
  const frame = { referenceFrame: 'world', epochJdTt: 1, originM: [0, 0, 0] as const,
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1] as const, metersPerUnit: 1, bodyRadiusM: 1000 };
  const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
  const arrival: PreparedArrivalView = { defaultDataset: 'photo', datasetIds: ['photo'], rotation,
    billboard: { url: '/scenes/body/arrival.webp', size: 1024, focalPixels: 1000, distanceM: 8000, dataset: 'photo', rotation } };
  for (const focalPixels of [338, 710, 1247]) for (const distanceUnits of [2200, 4000, 8000]) {
    const optics = { focalPixels, principalOffsetPixels: [0, 0] as const };
    const target = worldCameraFromCenteredPresentation({ rotation, distanceUnits }, frame, optics);
    const fitted = frameArrivalBillboard(arrival, target, frame, optics);
    assert.equal(canUseArrivalBillboard(arrival, fitted, frame, optics), true);
    const before = presentWorldCamera(target, frame, optics), after = presentWorldCamera(fitted, frame, optics);
    assert.ok(Math.abs(after.distanceM - arrival.billboard!.distanceM) < 1e-8);
    assert.ok(Math.abs(after.silhouette!.tangentialSemiAxis - before.silhouette!.tangentialSemiAxis) < 1e-8,
      'the responsive screen size survives without changing the prepared perspective');
    const effectiveFocal = focalPixels * (fitted.projectionScale ?? 1);
    const imageScale = effectiveFocal / arrival.billboard!.focalPixels;
    // Interior points at different depths must match too: equal silhouettes
    // alone allowed the old distant image to morph into a close perspective.
    for (const [x, y, z] of [[300, 200, 600], [-400, 50, -200], [100, -500, 100]]) {
      const depth = -after.bodyCenterUnits[2] - z;
      assert.ok(Math.abs(effectiveFocal * x / depth - imageScale * 1000 * x / (8000 - z)) < 1e-8);
      assert.ok(Math.abs(effectiveFocal * y / depth - imageScale * 1000 * y / (8000 - z)) < 1e-8);
    }
    assert.equal(canUseArrivalBillboard(arrival, fitted, frame, optics, 'other'), false);
  }
  const optics = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const };
  const overview = worldCameraFromCenteredPresentation({ rotation, distanceUnits: 10000 }, frame, optics);
  assert.equal(canUseArrivalBillboard(arrival, overview, frame, optics), false, 'an overview never detours closer');
});

test('arrival image shares the detail root position when shell chrome offsets the camera', async () => {
  const { document, window } = parseHTML('<html><body><div><main></main></div></body></html>');
  const stage = document.querySelector('main');
  assert.ok(stage);
  Object.defineProperty(window.HTMLImageElement.prototype, 'decode', { configurable: true, value: async () => {} });
  const frame = { referenceFrame: 'world', epochJdTt: 1, originM: [0, 0, 0] as const,
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1] as const, metersPerUnit: 1, bodyRadiusM: 1000 };
  const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
  const optics = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const,
    visibleRect: { left: -410, right: 410, top: -400, bottom: 456 } };
  const arrival: PreparedArrivalView = { defaultDataset: 'photo', datasetIds: ['photo'], rotation,
    billboard: { url: '/scenes/body/arrival.webp', size: 1024, focalPixels: 1000, distanceM: 10000, dataset: 'photo', rotation } };
  const camera = worldCameraFromCenteredPresentation({ rotation, distanceUnits: 10000 }, frame, optics);
  const controller = new AbortController();
  const billboard = await prepareArrivalBillboard(stage, arrival, frame, controller.signal);
  const image = document.querySelector('img');
  assert.ok(image);
  const placement = (x: number, y: number, scale: number) => {
    const prefix = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(`;
    assert.ok(image.style.transform.startsWith(prefix));
    assert.ok(Math.abs(Number(image.style.transform.slice(prefix.length, -1)) - scale) < 1e-10);
  };
  billboard.publish(camera, optics);
  placement(0, -28, 1);
  // The same retained image follows every layout, including changes during flight.
  for (const layout of [
    { name: 'centered desktop', rect: { left: -720, right: 720, top: -450, bottom: 450 }, x: 0, y: 0 },
    { name: 'portrait chrome', rect: { left: -195, right: 195, top: -300, bottom: 420 }, x: 0, y: -60 },
    { name: 'landscape chrome', rect: { left: -420, right: 420, top: -140, bottom: 220 }, x: 0, y: -40 },
    { name: 'horizontal and vertical inset', rect: { left: -500, right: 700, top: -350, bottom: 450 }, x: -100, y: -50 },
  ]) {
    billboard.publish(camera, { ...optics, visibleRect: layout.rect });
    placement(layout.x, layout.y, 1);
  }
  billboard.publish(camera, { ...optics, focalPixels: 500, principalOffsetPixels: [12, -8], visibleRect: null });
  placement(12, -8, 0.5);
  // Close framing follows the sphere's tangent silhouette, rather than inverse
  // centre distance (which would produce a scale of only 5 at this range).
  billboard.publish(worldCameraFromCenteredPresentation({ rotation, distanceUnits: 2000 }, frame, optics), optics);
  placement(0, -28, Math.sqrt(99 / 3));
  controller.abort();
  assert.equal(document.querySelector('img'), null);
  assert.equal(image.hasAttribute('src'), false);
});
