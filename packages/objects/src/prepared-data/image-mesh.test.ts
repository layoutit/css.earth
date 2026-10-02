import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImageMesh } from './image-mesh.js';

const MPC = 3.0856775814913673e22;
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: MPC,
  boundsUnits: { min: [-100, -100, -100], max: [100, 100, 100] } };
const leaf = { style: { width: '32px', height: '32px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '640px 640px', backgroundPosition: '-32px 0px' } };
const mesh = { schema: 'cssearth-image-mesh@1', id: 'sphere', name: 'Sphere', frame, radiusUnits: 100, texture: { path: 'sphere/sphere.webp' }, leaves: [leaf, leaf] };
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
