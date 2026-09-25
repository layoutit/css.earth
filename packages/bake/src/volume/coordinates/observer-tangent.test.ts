import { test } from 'vitest';
import assert from 'node:assert/strict';
import { angularScale, physicalToField, fieldToPhysical, physicalBounds } from './observer-tangent.ts';
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} differs from ${expected}`); }
test('one Earth ray retains its image coordinate at different physical depths', () => {
  const distance = 62.44, scale = angularScale(distance), tangent = [2, -1];
  for (const z of [-40, -5, 0, 10]) {
    const physical = [tangent[0]! * (distance + z) / distance, tangent[1]! * (distance + z) / distance, z];
    const field = physicalToField(physical, distance);
    close(field[0], tangent[0]! * scale); close(field[1], tangent[1]! * scale); close(field[2], z * scale);
    fieldToPhysical(field, distance).forEach((value, axis) => close(value, physical[axis]!));
  }
});
test('physical bake bounds retain every finite field corner and interior sample', () => {
  const bounds = { min: [-9000, -6000, -80000] as [number,number,number], max: [7000, 8000, 30000] as [number,number,number] };
  const physical = physicalBounds(bounds, 62.44);
  for (let ix = 0; ix <= 5; ix++) for (let iy = 0; iy <= 5; iy++) for (let iz = 0; iz <= 5; iz++) {
    const p = fieldToPhysical([bounds.min[0]+ix*(bounds.max[0]-bounds.min[0])/5,bounds.min[1]+iy*(bounds.max[1]-bounds.min[1])/5,bounds.min[2]+iz*(bounds.max[2]-bounds.min[2])/5],62.44);
    p.forEach((value,axis)=>assert.ok(value>=physical.min[axis]!-1e-10&&value<=physical.max[axis]!+1e-10));
  }
});
test('emission per angular depth converts to emission per kpc without changing projected light', () => {
  const scale=angularScale(62.44),sigma=900,steps=4096,dz=8*sigma/scale/steps;
  let angular=0,physical=0;
  for(let i=0;i<steps;i++){const z=(-4*sigma/scale)+(i+.5)*dz;const fieldZ=physicalToField([0,0,z],62.44)[2];const emission=Math.exp(-.5*(fieldZ/sigma)**2)/sigma;angular+=emission*(dz*scale);physical+=(emission*scale)*dz;}
  close(physical,angular);assert.ok(physical>2.5&&physical<2.51);
});
test('invalid observer, singular rays and reversed bounds are rejected', () => {
  assert.throws(()=>angularScale(0));assert.throws(()=>physicalToField([0,0,-62.44],62.44));
  assert.throws(()=>fieldToPhysical([NaN,0,0],62.44));
  assert.throws(()=>physicalBounds({min:[1,0,0],max:[0,1,1]},62.44));
});
