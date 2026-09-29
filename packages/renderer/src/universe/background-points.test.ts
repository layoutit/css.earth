import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import type { VolumeCameraPublication } from '../volume/types.js';
import { backgroundPointsOpacity, mountBackgroundPoints } from './background-points.js';
const pc = 3.085677581491367e16;
const publication: VolumeCameraPublication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
  pose: { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels: 500, principalOffsetPixels: [0, 0], widthPixels: 1000, heightPixels: 800 } };

test('outer-universe field fades continuously between Milky Way and Local Group scales', () => {
  expect(backgroundPointsOpacity(30_000 * pc)).toBe(0);
  expect(backgroundPointsOpacity(200_000 * pc)).toBe(0);
  expect(backgroundPointsOpacity(Math.sqrt(200_000 * 500_000) * pc)).toBeCloseTo(.5);
  expect(backgroundPointsOpacity(500_000 * pc)).toBe(1);
  expect(backgroundPointsOpacity(50e6 * pc)).toBe(1);
  let previous = 0;
  for (let distance = 200_000; distance <= 500_000; distance += 1000) {
    const alpha = backgroundPointsOpacity(distance * pc);
    expect(alpha).toBeGreaterThanOrEqual(previous);
    expect(alpha - previous).toBeLessThan(.02);
    previous = alpha;
  }
});

test('near views neither load nor show the galaxy banks', async () => {
  const { document } = parseHTML('<div id="host"><i></i></div>');
  const host = document.getElementById('host')!, before = host.firstElementChild!;
  const fetched: string[] = [];
  const field = mountBackgroundPoints(host, before, ['/a.json', '/b.json'], async url => { fetched.push(url); return new Promise(() => {}); });
  const roots = [...host.querySelectorAll<HTMLElement>('[data-catalogue-points]')];
  expect(roots).toHaveLength(2);
  field.publish(publication, 30_000 * pc);
  expect(fetched).toEqual([]);
  expect(roots.map(root => root.style.display)).toEqual(['none', 'none']);
  field.publish(publication, 1e6 * pc);
  expect(fetched).toEqual(['/a.json', '/b.json']);
  expect(roots.map(root => root.style.opacity)).toEqual(['1', '1']);
  field.publish(publication, 30_000 * pc);
  expect(roots.map(root => root.style.display)).toEqual(['none', 'none']);
  field.destroy();
  expect(host.querySelectorAll('[data-catalogue-points]')).toHaveLength(0);
});
