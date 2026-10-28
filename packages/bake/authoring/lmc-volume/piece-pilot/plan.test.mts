import test from 'node:test';import assert from 'node:assert/strict';import { planPieces } from './bake.mts';
import type { RegionBox } from './regions.mts';
const regions=[{id:'tarantula',box:{min:[0,0,0],max:[1,1,1]}as RegionBox},{id:'compact',box:{min:[2,2,2],max:[3,3,3]}as RegionBox}];
test('local XYZ volumes reserve their budget by removing background slabs',()=>{
 const pieces=planPieces(regions),physical=[0,1,2].map(a=>pieces.reduce((s,p)=>s+p.spec.counts[a]!,0)),copies=pieces.reduce((s,p)=>s+p.spec.hybrid!.densePerAxis.reduce((a,b)=>a+b,0),0);
 assert.deepEqual(physical,[10,10,7]);assert.equal(physical.reduce((a,b)=>a+b)+copies,33);assert.deepEqual(pieces[0]!.selection.exclude,regions.map(r=>r.box));
 for(let i=1;i<3;i++)assert.deepEqual(pieces[i]!.selection.include,regions[i-1]!.box);
 assert.throws(()=>planPieces(regions,256),/tiny rung/);
});
