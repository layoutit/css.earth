import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedNebulaFrame, embedNebulaVolume, reflectNebulaPoint, ARCSECOND_RADIANS, METERS_PER_PARSEC } from './nebula-frame.ts';
import { worldRotationFromQuaternion } from '../../../../../../../../src/renderers/css/navigation/world-camera-math.ts';
import { validatePreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/validation.ts';
import type { PreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/types.ts';
const frame = { referenceFrame:'lab',epochJdTt:0,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,
  metersPerUnit:1,boundsUnits:{min:[-3,-2,-1] as const,max:[4,2,1] as const} };
const sky = { centerIcrsDegrees:[0,0] as [number,number],distancePc:100,imageRotationDegrees:0,arcsecPerUnit:1 };
test('source west/north/away lands in ICRS without mirroring measured sky offsets or depth',()=>{
  const target=embedNebulaFrame(frame,sky,[2,3,4]), q=worldRotationFromQuaternion(target.localToReferenceXyzw), unit=100*METERS_PER_PARSEC*ARCSECOND_RADIANS;
  assert.ok(Math.abs(target.metersPerUnit/unit-1)<1e-14);
  // At RA=Dec=0 the basis is: east +Y, north +Z, away +X.
  for(const [i,expected] of [[0,100*METERS_PER_PARSEC+4*unit],[1,-2*unit],[2,3*unit]] as const)
    assert.ok(Math.abs(target.originM[i]-expected)<unit*1e-8);
  const p=reflectNebulaPoint([1,2,3]);
  const world=[q[0]*p[0]+q[1]*p[1]+q[2]*p[2],q[3]*p[0]+q[4]*p[1]+q[5]*p[2],q[6]*p[0]+q[7]*p[1]+q[8]*p[2]];
  assert.deepEqual(world.map(n=>Math.round(n)),[3,-1,2]);
  assert.deepEqual(target.boundsUnits,{min:[-4,-2,-1],max:[3,2,1]});
});
test('prepared CSS reflection follows PolyCSS physical XY permutation and leaves image bytes intact',()=>{
  const volume:PreparedCssVolume={schema:'cssearth-css-volume@1',id:'fixture',frame,anchors:[],
    stacks:(['x','y','z'] as const).map(axis=>({axis,leaves:[{id:axis,centerUnits:[1,2,3],texturePath:'texture.png',widthPx:1,heightPx:1,
      boundsCssPixels:{min:[5,10,15],max:[6,11,15]},style:{width:'1px',height:'1px',transform:'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,5,10,15,1)',backgroundSize:'1px 1px',backgroundPosition:'0px 0px'}}]})),
    resources:[{path:'texture.png',sha256:'a'.repeat(64),bytes:1,width:1,height:1}],provenance:{},approximation:{}};
  const result=validatePreparedCssVolume(embedNebulaVolume(volume,embedNebulaFrame(frame,sky),'physical','optical'));
  for(const stack of result.stacks) {
    assert.deepEqual(stack.leaves[0]!.centerUnits,[-1,2,3]);
    assert.equal(stack.leaves[0]!.style.transform,'matrix3d(1,0,0,0,0,-1,0,0,0,0,1,0,5,-10,15,1)');
    assert.deepEqual(stack.leaves[0]!.boundsCssPixels,{min:[5,-11,15],max:[6,-10,15]});
  }
  assert.equal(result.resources[0]!.sha256,volume.resources[0]!.sha256);
});
test('invalid physical frames cannot silently assign units or a sky direction',()=>{
  for(const change of [{distancePc:0},{arcsecPerUnit:NaN},{centerIcrsDegrees:[360,0] as [number,number]},{imageRotationDegrees:Infinity}])
    assert.throws(()=>embedNebulaFrame(frame,{...sky,...change}),/Invalid physical/);
});
