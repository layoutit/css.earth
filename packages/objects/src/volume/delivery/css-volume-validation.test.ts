import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedCssVolume } from './css-volume-validation.js';
import type { PreparedCssVolume } from './css-volume-types.js';

const valid = (): PreparedCssVolume => ({
  schema: 'cssearth-css-volume@1', id: 'milky-way',
  frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  anchors: [],
  stacks: [{ axis: 'x', leaves: [{ id: 'x-0', centerUnits: [0, 0, 0], texturePath: 'slices/x/00.png', widthPx: 2, heightPx: 2,
    style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'y', leaves: [{ id: 'y-0', centerUnits: [0, 0, 0], texturePath: 'slices/y/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'z', leaves: [{ id: 'z-0', centerUnits: [0, 0, 0], texturePath: 'slices/z/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] }],
  resources: ['x', 'y', 'z'].map(axis => ({ path: `slices/${axis}/00.png`, bytes: 2, width: 2, height: 2 })),
  provenance: {}, approximation: {},
});

test('accepts the direct prepared CSS volume payload and all three stacks', () => {
  assert.equal(validatePreparedCssVolume(valid()).stacks.length, 3);
});

test('rejects a runtime URL in authored leaf style', () => {
  const value = valid();
  Object.assign(value.stacks[0]!.leaves[0]!, { style: { ...value.stacks[0]!.leaves[0]!.style, transform: 'url(/runtime.png)' } });
  assert.throws(() => validatePreparedCssVolume(value), /URL-free/);
});

test('rotated bank normals must remain an orthonormal basis', () => {
  const value = valid();
  const normals = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
  value.stacks.forEach((stack, i) => Object.assign(stack, { normalUnits: normals[i] }));
  assert.deepEqual(validatePreparedCssVolume(value).stacks[0]!.normalUnits, [0, 1, 0]);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 1, 0] }); assert.throws(() => validatePreparedCssVolume(value), /orthogonal/);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 2, 0] }); assert.throws(() => validatePreparedCssVolume(value), /unit vector/);
});

test('keeps a merged-copies declaration of exactly three, and refuses any other count', () => {
  assert.equal(validatePreparedCssVolume({ ...valid(), mergedOpticalCopies: 3 }).mergedOpticalCopies, 3);
  assert.equal(validatePreparedCssVolume(valid()).mergedOpticalCopies, undefined);
  for (const count of [1, 2, 4, '3', null]) assert.throws(() => validatePreparedCssVolume({ ...valid(), mergedOpticalCopies: count }), /exactly three optical copies/);
});

test('merged and unmerged copies of the same geometry are different topology', async () => {
  const { samePreparedVolumeTopology } = await import('./prepared-volume-topology.js');
  assert.equal(samePreparedVolumeTopology(valid(), valid()), true);
  assert.equal(samePreparedVolumeTopology(valid(), { ...valid(), mergedOpticalCopies: 3 }), false);
  assert.equal(samePreparedVolumeTopology({ ...valid(), mergedOpticalCopies: 3 }, { ...valid(), mergedOpticalCopies: 3 }), true);
});

function hybrid(): PreparedCssVolume {
  const source=valid();
  const stacks=source.stacks.map(stack=>({...stack,leaves:stack.leaves.map(leaf=>({...leaf,opticalSlab:{id:leaf.id,role:'merged-three' as const}}))}));
  const z=stacks[2]!,base=z.leaves[0]!;
  const leaves:PreparedCssVolume['stacks'][number]['leaves']=[{...base,opticalSlab:{id:base.id,role:'single'}},{...base,id:'z-pair',texturePath:'slices/z/pair.png',opticalSlab:{id:base.id,role:'merged-two'}}];
  return{...source,mergedOpticalCopies:3,stacks:[stacks[0]!,stacks[1]!,{...z,leaves}],resources:[...source.resources,{path:'slices/z/pair.png',bytes:2,width:2,height:2}]};
}
test('hybrid optics require complete coincident slab groups and a declared layer budget',()=>{
  assert.equal(validatePreparedCssVolume(hybrid()).stacks[2]!.leaves.length,2);
  for(const corrupt of [
    (v:PreparedCssVolume)=>Object.assign(v,{mergedOpticalCopies:undefined}),
    (v:PreparedCssVolume)=>Object.assign(v.stacks[2]!.leaves[1]!,{centerUnits:[1,0,0]}),
    (v:PreparedCssVolume)=>Object.assign(v.stacks[2]!.leaves[1]!,{opticalSlab:{id:'other',role:'merged-two'}}),
    (v:PreparedCssVolume)=>Object.assign(v.stacks[2]!.leaves[1]!,{opticalSlab:{id:'z-0',role:'unknown'}}),
  ]){const value=hybrid();corrupt(value);assert.throws(()=>validatePreparedCssVolume(value));}
});
test('changing an optical role changes topology even when geometry is identical',async()=>{
  const {samePreparedVolumeTopology}=await import('./prepared-volume-topology.js'),a=hybrid(),b=hybrid();
  Object.assign(b.stacks[2]!.leaves[0]!,{opticalSlab:{id:'z-0',role:'merged-two'}});Object.assign(b.stacks[2]!.leaves[1]!,{opticalSlab:{id:'z-0',role:'single'}});
  assert.equal(samePreparedVolumeTopology(a,b),false);
});

test('physical distance handoff is structural, so presentation swaps cannot silently keep stale thresholds',async()=>{
 const{samePreparedVolumeTopology}=await import('./prepared-volume-topology.js');const base=valid(),views=Array.from({length:4},(_,i)=>({id:'view-'+i,texturePath:'far/'+i+'.png',back:[0,0,1]as const,right:[1,0,0]as const,down:[0,-1,0]as const}));const source:PreparedCssVolume={...base,resources:[...base.resources,...views.map(v=>({path:v.texturePath,width:1,height:1,bytes:1}))],impostors:{schema:'cssearth-volume-impostors@1',radiusUnits:2,fullBelowDiameterPixels:128,volumeAboveDiameterPixels:256,views}},a:PreparedCssVolume={...source,impostors:{...source.impostors!,distanceFade:{detailBelowUnits:20,impostorAboveUnits:35}}};
 assert.equal(samePreparedVolumeTopology(source,a),false);assert.equal(samePreparedVolumeTopology(a,{...a,impostors:{...a.impostors!,distanceFade:{detailBelowUnits:20,impostorAboveUnits:35}}}),true);assert.equal(samePreparedVolumeTopology(a,{...a,impostors:{...a.impostors!,distanceFade:{detailBelowUnits:21,impostorAboveUnits:35}}}),false);
});
