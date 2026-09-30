import { expect, test } from 'vitest';
import { compileCssSky, SKY_BASES, type BakedSky } from '@cssearth/bake/sky';
import { panoramaOrientation } from './panorama-view.js';
import { requireSurfacePanoramas } from './validation.js';
import { worldRotationFromQuaternion } from '../navigation/world-camera-math.js';

const forwardOf = (azimuthDeg: number, elevationDeg: number) => {
  const r = worldRotationFromQuaternion(panoramaOrientation(azimuthDeg, elevationDeg));
  // The camera looks along its -z axis: the third column, negated.
  return [-r[2], -r[5], -r[8]].map(value => Math.round(value * 1e6) / 1e6 + 0);
};

test('the look-around camera faces north, east and up in the panorama frame (x north, y west, z up)', () => {
  expect(forwardOf(0, 0)).toEqual([1, 0, 0]);
  expect(forwardOf(90, 0)).toEqual([0, -1, 0]);
  expect(forwardOf(0, 90)).toEqual([0, 0, 1]);
});

const face = (id: string) => `mars-panorama-landing-${id}.webp`;
function plan(overrides: Record<string, unknown> = {}) {
  const faces: BakedSky['faces'] = SKY_BASES.map(basis => ({ ...basis, texturePath: face(basis.id), widthPx: 64, heightPx: 64, bytes: 100,
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], vertices: ([[-1, 1], [1, 1], [1, -1], [-1, -1]] as const).map(([u, v]) => basis.forwardIcrf.map((f, i) => f + u * basis.rightIcrf[i]! + v * basis.upIcrf[i]!) as [number, number, number]) }));
  const { sky, resources } = compileCssSky({ faces, provenance: {}, approximation: {} }, { referenceFrame: 'surface-panorama-local-north-west-up', epochJdTt: 0 } as Parameters<typeof compileCssSky>[1]);
  return { schema: 'cssearth-surface-panorama-plan@1', source: { label: 'Collection', url: 'https://example.org/' }, frame: 'surface-panorama-local-north-west-up',
    panoramas: [{ id: 'landing', title: 'Landing', sols: [3, 11], camera: 'Mastcam-Z', credit: 'NASA/JPL-Caltech/ASU/MSSS', pageUrl: 'https://example.org/',
      site: { latitudeDeg: 18.44, longitudeDegEast: 77.45, localization: 'site 3 origin' }, spanDeg: 100, thumbnail: '/scenes/mars/mars-panorama-landing-thumbnail.webp',
      faces: SKY_BASES.map(basis => `/scenes/mars/${face(basis.id)}`), sky, resources, ...overrides }] };
}

test('a panorama plan names each cube face at a /scenes/ address, in the cube order, in the plan frame', () => {
  expect(requireSurfacePanoramas(plan()).panoramas[0]!.id).toBe('landing');
  expect(() => requireSurfacePanoramas(plan({ faces: [...SKY_BASES].reverse().map(basis => `/scenes/mars/${face(basis.id)}`) }))).toThrow(/in order/u);
  expect(() => requireSurfacePanoramas(plan({ thumbnail: 'https://elsewhere.example/t.webp' }))).toThrow(/scenes/u);
  expect(() => requireSurfacePanoramas(plan({ sols: [11, 3] }))).toThrow(/sols/u);
});
