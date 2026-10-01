import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalLook } from './arrival-look.ts';

const runtime = (id: string, pitch: number, colour: string) => ({ id, camera: { rotX: pitch, defaultTransform: `rotateX(${pitch === 89 ? 1.27e-14 : 6.36e-15}deg)` },
  tree: [{ className: `polycss-mesh ${id}-body`, style: `background-image:var(--${id}-surface-image);color:${colour}` }], sky: { registration: `matrix3d(${id.length})` } });
const images = (id: string, content: string) => [{ filename: `${id}-limb-color@2x.webp`, bytes: 99962, sha256: content }];

test('two bodies that differ only in who they are, their sky and rounding have one look', () => {
  assert.equal(arrivalLook('vhk-32', runtime('vhk-32', 89, '#ffe5cd'), images('vhk-32', 'a')), arrivalLook('m33sss-j013343', runtime('m33sss-j013343', 88.99999999999999, '#ffe5cd'), images('m33sss-j013343', 'a')));
});

test('a different drawn scene or a different delivered image is a different look', () => {
  const look = arrivalLook('vhk-32', runtime('vhk-32', 89, '#ffe5cd'), images('vhk-32', 'a'));
  assert.notEqual(look, arrivalLook('vhk-45', runtime('vhk-45', 89, '#ffd9b8'), images('vhk-45', 'a')), 'another colour in the scene');
  assert.notEqual(look, arrivalLook('vhk-45', runtime('vhk-45', 89, '#ffe5cd'), images('vhk-45', 'b')), 'another limb image under the same name');
  assert.notEqual(look, arrivalLook('vhk-45', runtime('vhk-45', 60, '#ffe5cd'), images('vhk-45', 'a')), 'another default view');
});
