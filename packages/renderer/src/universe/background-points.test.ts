import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import type { VolumeCameraPublication } from '../volume/types.js';
import { mountBackgroundPoints } from './background-points.js';
const pc = 3.085677581491367e16;
const publication: VolumeCameraPublication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
  pose: { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels: 500, principalOffsetPixels: [0, 0], widthPixels: 1000, heightPixels: 800 } };

test('inside our galaxy the banks neither load nor show', async () => {
  const { document } = parseHTML('<div id="host"><i></i></div>');
  const host = document.getElementById('host')!, before = host.firstElementChild!;
  const fetched: string[] = [];
  const field = mountBackgroundPoints(host, before, [{ url: '/a.json' }, { url: '/b.json' }], async url => { fetched.push(url); return new Promise(() => {}); });
  const roots = [...host.querySelectorAll<HTMLElement>('[data-catalogue-points]')];
  assert.equal(roots.length, 2);
  field.publish(publication, 8_000 * pc, 0);
  assert.deepEqual(fetched, []);
  assert.deepEqual(roots.map(root => root.style.display), ['none', 'none']);
  field.publish(publication, 1e6 * pc, 1);
  assert.deepEqual(fetched, ['/a.json', '/b.json']);
  assert.deepEqual(roots.map(root => root.style.opacity), ['0.7', '0.7'], 'fully outside, the background draws at its backdrop opacity');
  field.publish(publication, 8_000 * pc, 0);
  assert.deepEqual(roots.map(root => root.style.display), ['none', 'none']);
  field.destroy();
  assert.equal(host.querySelectorAll('[data-catalogue-points]').length, 0);
});

test('a far survey begins at its own distance: fetched there, whole one doubling later', async () => {
  const { document } = parseHTML('<div id="host"><i></i></div>');
  const host = document.getElementById('host')!, before = host.firstElementChild!;
  const fetched: string[] = [];
  const field = mountBackgroundPoints(host, before, [{ url: '/near.json' }, { url: '/far.json', fromDistanceM: 300e6 * pc }],
    async url => { fetched.push(url); return new Promise(() => {}); });
  field.publish(publication, 100e6 * pc, 1);
  assert.deepEqual(fetched, ['/near.json'], 'the Nearby Universe loads only the near bank');
  field.publish(publication, 450e6 * pc, 1);
  assert.deepEqual(fetched, ['/near.json', '/far.json']);
  field.destroy();
});
