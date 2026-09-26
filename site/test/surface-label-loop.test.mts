import { createCameraMotion } from '@cssearth/renderer/navigation';
import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { mountSurfaceFeatureLabels } from '@cssearth/renderer';
import { createSceneLifetime } from '@cssearth/engine';

test('surface labels keep no frame loop while they are off, the default', () => {
  const { document, window } = parseHTML('<html><body><div id="host"><div id="scene"><div id="mesh"></div></div></div></body></html>');
  const frames = new Map<number, () => void>();
  let next = 0;
  Object.assign(window, {
    requestAnimationFrame: (callback: () => void) => { frames.set(++next, callback); return next; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  const run = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  const lifetime = createSceneLifetime();
  const plan = { outline: { pieces: 0 }, catalog: { count: 0 }, policy: { minimumZoomShare: 0 } } as unknown as Parameters<typeof mountSurfaceFeatureLabels>[0]['plan'];
  const host = document.getElementById('host')!;
  const unused = (): never => { throw new Error('The label-loop fixture must not navigate.'); };
  const labels = mountSurfaceFeatureLabels({ host: document.getElementById('host')!, plan, objectId: 'moon', target: document.getElementById('mesh')!,
    pickingHost: host, inputSurface: host, flightLimits: unused,
    navigation: { motion: createCameraMotion(), frame: { referenceFrame:'test',epochJdTt:1,originM:[0,0,0],presentationToReference:[1,0,0,0,1,0,0,0,1],metersPerUnit:1,bodyRadiusM:1 },
      capture:unused,apply:unused,preparedFocus:unused,setPreparedFocus:unused,flyToPreparedFocus:unused,optics:unused,subscribe:unused },
    scene: document.getElementById('scene')!, zoomRange: () => ({ minimum: 1, maximum: 2 }), lifetime, onError() {},
    // The catalogue never arrives: this test is about the frame loop, not the labels it would place.
    transport: () => new Promise<Response>(() => {}) });

  labels.setPlaying(true);
  run(); run();
  assert.equal(frames.size, 0, 'playing scene, labels off: no frame is requested');
  assert.equal(labels.stats().frames, 0);

  document.body.dataset.surfaceLabels = 'on';
  document.body.dispatchEvent(new window.Event('objectsurfacelabelschange'));
  run(); run();
  assert.ok(labels.stats().frames >= 2, 'turning labels on starts the loop');

  document.body.dataset.surfaceLabels = 'off';
  document.body.dispatchEvent(new window.Event('objectsurfacelabelschange'));
  const settled = labels.stats().frames;
  run(); run();
  assert.equal(labels.stats().frames, settled, 'turning them off stops it again');
  lifetime.destroy();
});
