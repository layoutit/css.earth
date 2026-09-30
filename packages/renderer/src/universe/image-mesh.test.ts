import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { mountImageMesh, parseImageMesh } from './image-mesh.js';

const MPC = 3.0856775814913673e22;
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: MPC,
  boundsUnits: { min: [-100, -100, -100], max: [100, 100, 100] } };
const leaf = { style: { width: '32px', height: '32px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '640px 640px', backgroundPosition: '-32px 0px' } };
const mesh = { schema: 'cssearth-image-mesh@1', id: 'sphere', name: 'Sphere', frame, radiusUnits: 100, texture: { path: 'sphere/sphere.webp' }, leaves: [leaf, leaf] };
const viewport = { focalPixels: 800, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
const at = (mpc: number) => ({ world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, pose: { positionM: [0, 0, mpc * MPC] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport });

test('an image mesh bank names its texture, radius and leaves, and refuses a malformed one', () => {
  assert.equal(parseImageMesh(mesh).leaves.length, 2);
  assert.throws(() => parseImageMesh({ ...mesh, radiusUnits: 0 }), /sphere: the mesh needs a positive radius/);
  assert.throws(() => parseImageMesh({ ...mesh, name: '' }), /sphere: the mesh needs the name/);
  assert.deepEqual(parseImageMesh({ ...mesh, limb: { path: 'sphere/limb.webp', edge: .98 } }).limb, { path: 'sphere/limb.webp', edge: .98 });
  assert.throws(() => parseImageMesh({ ...mesh, limb: { path: 'sphere/limb.webp', edge: 2 } }), /limb plate needs/);
  assert.throws(() => parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, transform: '' } }] }), /sphere: leaf 0 needs its/);
  assert.equal(parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, borderRadius: '50%' } }] }).leaves[0]!.style.borderRadius, '50%', 'a polar cap is a disc');
  assert.throws(() => parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, borderRadius: '3px' } }] }), /rounds only to a disc/);
});

test('a mesh loads when it may show, then shows only from outside, fading in from its radius to twice that', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  let fetched = 0;
  const mounted = mountImageMesh({ host, before: null, url: '/sphere.json', fetchJson: async () => { fetched++; return { ...mesh, limb: { path: 'sphere/limb.webp', edge: .98 } }; }, resolveResource: path => `/${path}` });
  assert.equal(mounted.publish(at(300), 0), 0);
  assert.equal(fetched, 0, 'nothing loads while the caller keeps it hidden');
  assert.equal(mounted.publish(at(300), 1), 0);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fetched, 1);
  assert.equal(mounted.root.querySelectorAll('s').length, 2);
  assert.ok(mounted.root.querySelector<HTMLElement>('s')!.style.backgroundImage.includes('/sphere/sphere.webp'));
  assert.ok(mounted.root.querySelector<HTMLElement>('i')!.style.backgroundImage.includes('/sphere/limb.webp'), 'its limb plate');
  assert.equal(host.querySelector('[data-image-mesh-label="sphere"]')!.textContent, 'Sphere', 'and its caption');
  assert.equal(mounted.publish(at(50), 1), 0, 'inside the sphere it is not drawn');
  assert.equal(mounted.root.style.display, 'none');
  assert.ok(Math.abs(mounted.publish(at(150), 1) - (.5)) < 10 ** -2 / 2, `${mounted.publish(at(150), 1)} is not close to ${.5}`);
  assert.equal(mounted.publish(at(250), 1), 1, 'whole from twice its radius');
  assert.equal(mounted.publish(at(250), .5), .5, "the caller's opacity scales it");
  mounted.destroy();
  assert.equal(host.children.length, 0);
});

test('a limb that cannot be resolved leaves the sphere and its caption, and another subject can own the caption', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const errors: unknown[] = [], original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const mounted = mountImageMesh({ host, before: null, url: '/sphere.json', fetchJson: async () => ({ ...mesh, limb: { path: 'sphere/limb.webp', edge: .98 } }),
      resolveResource: path => { if (path.endsWith('limb.webp')) throw new Error('unavailable'); return `/${path}`; } });
    mounted.publish(at(300), 1);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(mounted.root.dataset.imageMesh, 'sphere', 'the sphere mounted');
    assert.equal(mounted.root.querySelector('i'), null, 'without its limb');
    assert.equal(host.querySelector('[data-image-mesh-label="sphere"]')!.textContent, 'Sphere');
    assert.equal(errors.length, 1);
    const label = host.querySelector<HTMLElement>('[data-image-mesh-label]')!;
    mounted.publish(at(250), 1, false);
    assert.equal(label.style.opacity, '0', 'a focus owns the caption');
    mounted.destroy();
  } finally { console.error = original; }
});
