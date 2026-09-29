import { physicalProjectionFromCamera } from '@cssearth/renderer/prepared-data/physical-projection.ts';
import { createCameraMotion } from '@cssearth/renderer/navigation';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { mountSurfaceFeatureLabels } from '@cssearth/renderer';
import { createSceneLifetime } from '@cssearth/engine';

test('surface labels keep no frame loop while they are off, the default', async () => {
  const { document, window } = parseHTML('<html><body><div id="host"><div id="scene"><div id="mesh"></div></div></div></body></html>');
  const frames = new Map<number, () => void>();
  let next = 0;
  Object.assign(window, {
    requestAnimationFrame: (callback: () => void) => { frames.set(++next, callback); return next; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  const run = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  const lifetime = createSceneLifetime();
  let release!: (response: Response) => void;
  const plan = { outline: { pieces: 256 }, catalog: { count: 0 }, policy: { minimumZoomShare: 0 } } as unknown as Parameters<typeof mountSurfaceFeatureLabels>[0]['plan'];
  const host = document.getElementById('host')!;
  const unused = (): never => { throw new Error('The label-loop fixture must not navigate.'); };
  const labels = mountSurfaceFeatureLabels({ host: document.getElementById('host')!, plan, objectId: 'moon', target: document.getElementById('mesh')!,
    pickingHost: host, inputSurface: host, flightLimits: unused,
    navigation: { motion: createCameraMotion(), frame: { referenceFrame:'test',epochJdTt:1,originM:[0,0,0],presentationToReference:[1,0,0,0,1,0,0,0,1],metersPerUnit:1,bodyRadiusM:1 },
      capture:unused,apply:unused,preparedFocus:unused,setPreparedFocus:unused,flyToPreparedFocus:unused,optics:unused,subscribe:unused },
    scene: document.getElementById('scene')!, zoomRange: () => ({ minimum: 1, maximum: 2 }), lifetime, onError() {},
    // Hold the catalogue while checking the disabled loop, then explicitly release it to check pool allocation.
    transport: () => new Promise<Response>(resolve => { release = resolve; }) });

  assert.equal(host.querySelector('.prepared-surface-features'), null, 'disabled feature UI is not mounted');
  assert.equal(host.querySelectorAll('[data-feature-outline-piece]').length, 0, 'disabled labels allocate no outline pool');
  labels.setPlaying(true);
  for (let frame = 0; frame < 30; frame++) labels.publish({ projection: physicalProjectionFromCamera([1,0,0,0,1,0,0,0,1], [0,0,-3], 1, { focalPixels: 1000, principalOffsetPixels: [0,0] }),
    levelOfDetail: { stage: 'marker', silhouetteDiameter: 1, markerOpacity: 1, billboardOpacity: 0 }, zoom: 1 });
  assert.equal(frames.size, 0, 'camera publications do not schedule disabled labels');
  run(); run();
  assert.equal(frames.size, 0, 'playing scene, labels off: no frame is requested');
  assert.equal(labels.stats().frames, 0);

  document.body.dataset.surfaceLabels = 'on';
  document.body.dispatchEvent(new window.Event('objectsurfacelabelschange'));
  run(); run();
  assert.equal(frames.size, 0, 'enabled labels with no loaded catalogue cannot draw');
  assert.equal(labels.stats().frames, 0);

  document.body.dataset.surfaceLabels = 'off';
  document.body.dispatchEvent(new window.Event('objectsurfacelabelschange'));
  const settled = labels.stats().frames;
  run(); run();
  assert.equal(labels.stats().frames, settled, 'turning them off stops it again');
  const loaded = labels.loaded();
  release(new Response(JSON.stringify({ schema: 'cssearth-prepared-surface-features@1', objectId: 'moon',
    source: 'fixture', snapshotDate: '2026-09-27', sourcePage: 'https://example.org', license: 'fixture', qualification: 'fixture', features: [] })));
  await loaded;
  const pieces = [...host.querySelectorAll('[data-feature-outline-piece]')];
  assert.equal(pieces.length, 256, 'an explicit catalogue request prepares the retained outline capacity');
  await labels.loaded();
  assert.deepEqual([...host.querySelectorAll('[data-feature-outline-piece]')], pieces, 'repeated requests reuse the same nodes');
  lifetime.destroy();
  assert.equal(host.querySelector('.prepared-surface-features'), null);
});
