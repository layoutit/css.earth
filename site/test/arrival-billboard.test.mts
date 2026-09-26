import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { worldCameraFromCenteredPresentation, presentWorldCamera } from '@cssearth/renderer/navigation';
import { prepareArrivalBillboard, arrivalBillboardHandoff } from '../arrival-billboard.mts';
import type { PreparedArrivalView } from '@cssearth/objects';

test('all responsive close-ups hand off at the baked physical perspective', () => {
  const frame = { referenceFrame: 'world', epochJdTt: 1, originM: [0, 0, 0] as const,
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1] as const, metersPerUnit: 1, bodyRadiusM: 1000 };
  const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
  const arrival: PreparedArrivalView = { defaultLens: 'photo', lensIds: ['photo'], rotation,
    billboard: { url: '/scenes/body/arrival.webp', size: 1024, focalPixels: 1000, distanceM: 8000, lens: 'photo', rotation } };
  for (const focalPixels of [338, 710, 1247]) for (const distanceUnits of [2200, 4000, 8000]) {
    const optics = { focalPixels, principalOffsetPixels: [0, 0] as const };
    const target = worldCameraFromCenteredPresentation({ rotation, distanceUnits }, frame, optics);
    const handoff = arrivalBillboardHandoff(arrival, target, frame, optics);
    assert.ok(handoff);
    assert.equal(presentWorldCamera(handoff, frame, optics).distanceM, 8000);
    assert.equal(presentWorldCamera(target, frame, optics).distanceM, distanceUnits, 'responsive endpoint stays unchanged');
    assert.equal(arrivalBillboardHandoff(arrival, target, frame, optics, 'other'), null);
  }
  const optics = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const };
  const overview = worldCameraFromCenteredPresentation({ rotation, distanceUnits: 10000 }, frame, optics);
  assert.equal(arrivalBillboardHandoff(arrival, overview, frame, optics), null, 'an overview never detours closer');
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
  const arrival: PreparedArrivalView = { defaultLens: 'photo', lensIds: ['photo'], rotation,
    billboard: { url: '/scenes/body/arrival.webp', size: 1024, focalPixels: 1000, distanceM: 10000, lens: 'photo', rotation } };
  const camera = worldCameraFromCenteredPresentation({ rotation, distanceUnits: 10000 }, frame, optics);
  const controller = new AbortController();
  const billboard = await prepareArrivalBillboard(stage, arrival, frame, controller.signal);
  const image = document.querySelector('img');
  assert.ok(image);
  billboard.publish(camera, optics);
  assert.equal(image.style.transform, 'translate(-50%, -50%) translate(0px, -28px) scale(1)');
  // The same retained image follows every layout, including changes during flight.
  for (const layout of [
    { name: 'centered desktop', rect: { left: -720, right: 720, top: -450, bottom: 450 }, x: 0, y: 0 },
    { name: 'portrait chrome', rect: { left: -195, right: 195, top: -300, bottom: 420 }, x: 0, y: -60 },
    { name: 'landscape chrome', rect: { left: -420, right: 420, top: -140, bottom: 220 }, x: 0, y: -40 },
    { name: 'horizontal and vertical inset', rect: { left: -500, right: 700, top: -350, bottom: 450 }, x: -100, y: -50 },
  ]) {
    billboard.publish(camera, { ...optics, visibleRect: layout.rect });
    assert.equal(image.style.transform, `translate(-50%, -50%) translate(${layout.x}px, ${layout.y}px) scale(1)`, layout.name);
  }
  billboard.publish(camera, { ...optics, focalPixels: 500, principalOffsetPixels: [12, -8], visibleRect: null });
  assert.equal(image.style.transform, 'translate(-50%, -50%) translate(12px, -8px) scale(0.5)');
  controller.abort();
  assert.equal(document.querySelector('img'), null);
  assert.equal(image.hasAttribute('src'), false);
});
