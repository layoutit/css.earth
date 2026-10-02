import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import type { PreparedCssVolume } from '../volume/types.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedCssSky } from './prepared-sky-runtime.js';
import { holdStartup, releaseStartup } from '../rendering/startup-gate.js';

// The Milky Way's prepared sky, as the app mounts it.
const volume = JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way-volume/prepared/volume.json', import.meta.url), 'utf8')).data as PreparedCssVolume;

test('while a body\'s first view holds the gate, the sky faces in view wait for it, then take exactly their images', () => {
  const { document, window } = parseHTML('<div id="host"><i></i></div>');
  const idle: (() => void)[] = [];
  Reflect.set(window, 'requestIdleCallback', (run: () => void) => idle.push(run));
  const host = document.getElementById('host')!, before = host.firstElementChild!;
  const sky = volume.sky!;
  const runtime = mountPreparedCssSky({ host, before, payload: sky, resources: volume.resources, resolveResource: path => `/milky-way/${path}` });
  const faces = [...runtime.root.querySelectorAll<HTMLElement>('[data-sky-face]')];
  const world: WorldCameraPose = { referenceFrame: sky.referenceFrame, epochJdTt: sky.epochJdTt, pose: { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] } };
  const viewport: WorldCameraViewport = { focalPixels: 900, principalOffsetPixels: [0, 0], widthPixels: 1194, heightPixels: 834 };
  holdStartup(window as unknown as Window);
  runtime.publish(world, viewport);
  const inView = faces.map(face => face.style.visibility !== 'hidden');
  assert.ok(inView.some(Boolean));
  assert.deepEqual(faces.map(face => face.style.backgroundImage), faces.map(() => ''), 'no face fetches before the first view is interactive');
  releaseStartup(window as unknown as Window);
  assert.equal(idle.length, 1);
  idle[0]!();
  assert.deepEqual(faces.map(face => face.style.backgroundImage),
    sky.faces.map((face, index) => inView[index] ? `url("/milky-way/${face.texturePath}")` : ''), 'the faces in view, and only they');
  runtime.destroy();
});
