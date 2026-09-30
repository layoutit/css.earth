import { expect, test } from 'vitest';
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
  expect(parseImageMesh(mesh).leaves).toHaveLength(2);
  expect(() => parseImageMesh({ ...mesh, radiusUnits: 0 })).toThrow(/sphere: the mesh needs a positive radius/);
  expect(() => parseImageMesh({ ...mesh, name: '' })).toThrow(/sphere: the mesh needs the name/);
  expect(parseImageMesh({ ...mesh, limb: { path: 'sphere/limb.webp', edge: .98 } }).limb).toEqual({ path: 'sphere/limb.webp', edge: .98 });
  expect(() => parseImageMesh({ ...mesh, limb: { path: 'sphere/limb.webp', edge: 2 } })).toThrow(/limb plate needs/);
  expect(() => parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, transform: '' } }] })).toThrow(/sphere: leaf 0 needs its/);
  expect(parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, borderRadius: '50%' } }] }).leaves[0]!.style.borderRadius, 'a polar cap is a disc').toBe('50%');
  expect(() => parseImageMesh({ ...mesh, leaves: [{ style: { ...leaf.style, borderRadius: '3px' } }] })).toThrow(/rounds only to a disc/);
});

test('a mesh loads when it may show, then shows only from outside, fading in from its radius to twice that', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  let fetched = 0;
  const mounted = mountImageMesh({ host, before: null, url: '/sphere.json', fetchJson: async () => { fetched++; return { ...mesh, limb: { path: 'sphere/limb.webp', edge: .98 } }; }, resolveResource: path => `/${path}` });
  expect(mounted.publish(at(300), 0)).toBe(0);
  expect(fetched, 'nothing loads while the caller keeps it hidden').toBe(0);
  expect(mounted.publish(at(300), 1)).toBe(0);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetched).toBe(1);
  expect(mounted.root.querySelectorAll('s')).toHaveLength(2);
  expect(mounted.root.querySelector<HTMLElement>('s')!.style.backgroundImage).toContain('/sphere/sphere.webp');
  expect(mounted.root.querySelector<HTMLElement>('i')!.style.backgroundImage, 'its limb plate').toContain('/sphere/limb.webp');
  expect(host.querySelector('[data-image-mesh-label="sphere"]')!.textContent, 'and its caption').toBe('Sphere');
  expect(mounted.publish(at(50), 1), 'inside the sphere it is not drawn').toBe(0);
  expect(mounted.root.style.display).toBe('none');
  expect(mounted.publish(at(150), 1)).toBeCloseTo(.5);
  expect(mounted.publish(at(250), 1), 'whole from twice its radius').toBe(1);
  expect(mounted.publish(at(250), .5), "the caller's opacity scales it").toBe(.5);
  mounted.destroy();
  expect(host.children).toHaveLength(0);
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
    expect(mounted.root.dataset.imageMesh, 'the sphere mounted').toBe('sphere');
    expect(mounted.root.querySelector('i'), 'without its limb').toBeNull();
    expect(host.querySelector('[data-image-mesh-label="sphere"]')!.textContent).toBe('Sphere');
    expect(errors).toHaveLength(1);
    const label = host.querySelector<HTMLElement>('[data-image-mesh-label]')!;
    mounted.publish(at(250), 1, false);
    expect(label.style.opacity, 'a focus owns the caption').toBe('0');
    mounted.destroy();
  } finally { console.error = original; }
});

test('a hidden sphere asks for no texture and draws only its caption, naming what it bounds, until it is shown', async () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const mounted = mountImageMesh({ host, before: null, url: '/sphere.json', fetchJson: async () => ({ ...mesh, limb: { path: 'sphere/limb.webp', edge: .98 } }),
    resolveResource: path => `/${path}`, hidden: true, hiddenCaption: 'Observable Universe' });
  mounted.publish(at(300), 1);
  await new Promise(resolve => setTimeout(resolve, 0));
  const leaves = () => [...mounted.root.querySelectorAll<HTMLElement>('s')];
  expect(leaves().map(node => node.style.backgroundImage), 'no leaf names the texture').toEqual(['', '']);
  expect(mounted.root.querySelector('i'), 'nor is the limb mounted').toBeNull();
  expect(mounted.publish(at(300), 1), 'it covers nothing').toBe(0);
  expect(mounted.root.style.display).toBe('none');
  const label = host.querySelector<HTMLElement>('[data-image-mesh-label="sphere"]')!;
  expect(label.textContent).toBe('Observable Universe');
  mounted.setHidden(false);
  expect(leaves().every(node => node.style.backgroundImage.includes('/sphere/sphere.webp')), 'shown, every leaf takes the texture').toBe(true);
  expect(mounted.root.querySelector<HTMLElement>('i')!.style.backgroundImage).toContain('/sphere/limb.webp');
  expect(label.textContent, 'and the caption its own name').toBe('Sphere');
  expect(mounted.publish(at(300), 1)).toBe(1);
  mounted.destroy();
});
