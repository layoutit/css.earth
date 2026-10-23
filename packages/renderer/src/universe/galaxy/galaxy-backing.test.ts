import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseGalaxyBacking, GALAXY_BACKING_SCHEMA } from '@cssearth/objects';
import { mountGalaxyBacking } from './galaxy-backing.js';

test('a backing mounts the shared parsed leaf and removes it when destroyed', () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const payload = parseGalaxyBacking({ schema: GALAXY_BACKING_SCHEMA, id: 'backing',
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    leaf: { texturePath: 'backing/backing.webp', style: { width: '32px', height: '16px', transform: 'translateZ(0px)',
      backgroundSize: '32px 16px', backgroundPosition: '0px 0px' } } });
  const mounted = mountGalaxyBacking({ host, before: null, payload, resolveResource: path => `/${path}` });
  const leaf = mounted.root.querySelector<HTMLImageElement>('img')!;
  assert.equal(leaf.style.width, payload.leaf.style.width);
  assert.equal(leaf.style.height, payload.leaf.style.height);
  assert.equal(leaf.style.transform, payload.leaf.style.transform);
  assert.equal(leaf.style.transformOrigin, '0 0', 'placed from its corner, as a volume leaf is');
  assert.equal(leaf.getAttribute('src'), '/backing/backing.webp', 'an image the browser composites as it is, not a painted box');
  assert.equal(leaf.getAttribute('alt'), '');
  assert.equal(host.children.length, 1);
  mounted.destroy();
  assert.equal(host.children.length, 0);
  // An img fills its box: a leaf prepared with any other placement of its image is refused by name.
  const cropped = { ...payload, leaf: { ...payload.leaf, style: { ...payload.leaf.style, backgroundSize: '64px 16px' } } };
  assert.throws(() => mountGalaxyBacking({ host, before: null, payload: cropped, resolveResource: path => `/${path}` }),
    /backing: the backing leaf backing\/backing\.webp is drawn as an image filling its box; its backgroundSize must be "32px 16px" \(got "64px 16px"\)/);
});

test('a fixed picture accepts the same native focal length and unit scale as its volume', () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const frame = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
  const picture = mountGalaxyBacking({ host, before: null, payload: { id: 'fixture', frame, leaf: { texturePath: 'picture.png',
    style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } } },
  resolveResource: path => path, nativeFocalCss: '400px', unitScale: 100 });
  try {
    picture.publish({ world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
      viewport: { focalPixels: 900, principalOffsetPixels: [0, 0] } });
    assert.equal(picture.root.querySelector<HTMLElement>('.css-volume-camera')!.style.perspective, '400px');
    assert.ok(picture.root.querySelector<HTMLElement>('.css-volume-scene')!.style.transform.includes('calc(400px + -1000px)'));
  } finally { picture.destroy(); }
});
