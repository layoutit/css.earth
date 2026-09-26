import { expect, test, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import type { VolumeCameraPublication } from '../volume/types.js';
import { mountGalaxyPoints } from './galaxy-points.js';
import { backgroundPointsOpacity, mountBackgroundPoints } from './background-points.js';
vi.mock('./galaxy-points.js', () => ({ mountGalaxyPoints: vi.fn() }));
const pc = 3.085677581491367e16;
const publication: VolumeCameraPublication = { world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
  pose: { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels: 500, principalOffsetPixels: [0, 0] } };

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

test('near views neither load nor publish the field; an in-flight load cannot reveal it', async () => {
  const { document } = parseHTML('<div id="host"><i></i></div>');
  const host = document.getElementById('host')!, before = host.firstElementChild!;
  const publish = vi.fn(), destroy = vi.fn();
  let finish!: (runtime: Awaited<ReturnType<typeof mountGalaxyPoints>>) => void;
  vi.mocked(mountGalaxyPoints).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const field = mountBackgroundPoints(host, before, '/points.json');
  const root = host.querySelector<HTMLElement>('[data-galaxy-field]')!;
  field.publish(publication, 30_000 * pc);
  expect(root.style.display).toBe('none');
  expect(mountGalaxyPoints).not.toHaveBeenCalled();
  field.publish(publication, 1e6 * pc);
  expect(mountGalaxyPoints).toHaveBeenCalledTimes(1);
  field.publish(publication, 30_000 * pc);
  finish({ publish, destroy, roots: [] });
  await Promise.resolve();
  expect(root.style.display).toBe('none');
  expect(publish).not.toHaveBeenCalled();
  field.publish(publication, 1e6 * pc);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(root.style.opacity).toBe('1');
  field.publish(publication, 30_000 * pc);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(root.style.opacity).toBe('0');
  field.destroy();
  expect(destroy).toHaveBeenCalledOnce();
});
