import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedNebulaFrame, embedNebulaVolume, reflectNebulaPoint, ARCSECOND_RADIANS, METERS_PER_PARSEC } from './nebula-frame.ts';
import { worldRotationFromQuaternion } from '../../../../../../../../src/renderers/css/navigation/world-camera-math.ts';
import { validatePreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/validation.ts';
import type { PreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/types.ts';
import { compileCssVolume } from '../../../../../../../../src/renderers/css/preparation/volume.ts';
import { compilerFrame, compilerPreparedPoint, compilerPreparedSlices } from '@cssearth/volume-core/coordinates/compiler-frame';
import type { VolumeSlices } from '@cssearth/volume-core/contracts/volume-slices';
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

test('new physical compiler transport and historical source transport produce identical app sky geometry', () => {
  const bounds = { min: [-4, -3, -2] as [number, number, number], max: [4, 3, 2] as [number, number, number] };
  const angular = compilerFrame(bounds), physical = compilerFrame(bounds, true);
  const slices: VolumeSlices = { boundsUnits: bounds, quads: [{ id: 'z-0', axis: 'z', sliceIndex: 0,
    texturePath: 'a.png', widthPx: 2, heightPx: 2, vertices: [[-2, 2, -1], [2, 2, -1], [2, -2, -1], [-2, -2, -1]],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, -1], normal: [0, 0, 1], sha256: 'a'.repeat(64), bytes: 12, alphaCoverage: 1 }],
    provenance: {}, approximation: { method: 'fixture', radialEmission: 'none', limitations: [], samplesPerSlab: 4,
      opticalWeight: 1, exposureGain: 1, sliceCounts: { x: 1, y: 1, z: 1 }, slabPitchUnits: { x: 8, y: 6, z: 4 } } };
  for (const axis of ['x', 'y'] as const) slices.quads.push({ ...slices.quads[0]!, id: `${axis}-0`, axis,
    normal: axis === 'x' ? [1, 0, 0] : [0, 1, 0], alphaCoverage: 0 });
  const oldBank = compileCssVolume({ id: 'angular', frame: angular.frame, slices, recipe: { anchors: [] } });
  const newBank = compileCssVolume({ id: 'physical', frame: physical.frame, slices: compilerPreparedSlices(slices), recipe: { anchors: [] } });
  const oldApp = embedNebulaVolume(oldBank, embedNebulaFrame(angular.frame, sky), 'same', 'same');
  const newApp = embedNebulaVolume(newBank, embedNebulaFrame(physical.frame, sky), 'same', 'same');
  assert.deepEqual(newApp.frame, oldApp.frame);
  assert.deepEqual(newApp.resources, oldApp.resources);
  for (const axis of ['x', 'y', 'z'] as const) {
    const before = oldApp.stacks.find(stack => stack.axis === axis)!, after = newApp.stacks.find(stack => stack.axis === axis)!;
    assert.equal(after.leaves.length, before.leaves.length);
    for (let i = 0; i < before.leaves.length; i++) {
      const oldLeaf = before.leaves[i]!, newLeaf = after.leaves[i]!;
      assert.deepEqual(newLeaf.centerUnits, oldLeaf.centerUnits);
      assert.deepEqual(newLeaf.boundsCssPixels, oldLeaf.boundsCssPixels);
      assert.equal(newLeaf.texturePath, oldLeaf.texturePath);
      const matrix = (value: string) => value.slice(9, -1).split(',').map(Number);
      const a = matrix(oldLeaf.style.transform), b = matrix(newLeaf.style.transform);
      // Plane-local Z is always zero; compare every rendered corner, not its unused normal column.
      for (const x of [0, Number.parseFloat(oldLeaf.style.width)]) for (const y of [0, Number.parseFloat(oldLeaf.style.height)])
        for (const row of [0, 1, 2]) assert.ok(Math.abs(a[row]! * x + a[row + 4]! * y + a[row + 12]! -
          b[row]! * x - b[row + 4]! * y - b[row + 12]!) < 1e-9);
    }
  }
  for (const point of [[1, 2, -1], [-2, 1, 1]] as [number, number, number][]) {
    assert.deepEqual(reflectNebulaPoint(compilerPreparedPoint(point), physical.frame), reflectNebulaPoint(point, angular.frame));
  }
});
