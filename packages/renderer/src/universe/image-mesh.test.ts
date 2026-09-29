import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { mountImageMesh, parseImageMesh } from './image-mesh.js';

const MPC = 3.0856775814913673e22;
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: MPC,
  boundsUnits: { min: [-100, -100, -100], max: [100, 100, 100] } };
const leaf = { style: { width: '32px', height: '32px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '640px 640px', backgroundPosition: '-32px 0px' } };
const mesh = { schema: 'cssearth-image-mesh@1', id: 'sphere', frame, radiusUnits: 100, texture: { path: 'sphere/sphere.webp' }, leaves: [leaf, leaf] };
const viewport = { focalPixels: 800, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
const at = (mpc: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, mpc * MPC] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });

test('an image mesh bank names its texture, radius and leaves, and refuses a malformed one', () => {
  expect(parseImageMesh(mesh).leaves).toHaveLength(2);
  expect(() => parseImageMesh({ ...mesh, radiusUnits: 0 })).toThrow(/sphere: the mesh needs a positive radius/);
  expect(() => parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, transform: '' } }] })).toThrow(/sphere: leaf 0 needs its/);
});

test('a mesh loads when it may show, then shows only from outside, fading in from its radius to twice that', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  let fetched = 0;
  const mounted = mountImageMesh({ host, before: null, url: '/sphere.json', fetchJson: async () => { fetched++; return mesh; }, resolveResource: path => `/${path}` });
  expect(mounted.publish(at(300), 0)).toBe(0);
  expect(fetched, 'nothing loads while the caller keeps it hidden').toBe(0);
  expect(mounted.publish(at(300), 1)).toBe(0);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetched).toBe(1);
  expect(mounted.root.querySelectorAll('s')).toHaveLength(2);
  expect(mounted.root.querySelector<HTMLElement>('s')!.style.backgroundImage).toContain('/sphere/sphere.webp');
  expect(mounted.publish(at(50), 1), 'inside the sphere it is not drawn').toBe(0);
  expect(mounted.root.style.display).toBe('none');
  expect(mounted.publish(at(150), 1)).toBeCloseTo(.5);
  expect(mounted.publish(at(250), 1), 'whole from twice its radius').toBe(1);
  expect(mounted.publish(at(250), .5), "the caller's opacity scales it").toBe(.5);
  mounted.destroy();
  expect(host.children).toHaveLength(0);
});
