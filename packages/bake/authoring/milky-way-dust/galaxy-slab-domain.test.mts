import assert from 'node:assert/strict';import test from 'node:test';
import {clipSlabRay,slabDomain} from './galaxy-slab-domain.mts';
test('an opt-in slab clips both ray directions and keeps shared faces half open',()=>{
 const slab=slabDomain(2,-1,1);assert.deepEqual(clipSlabRay([0,20],[0,0,5],[0,0,-1],slab),[4,6]);assert.deepEqual(clipSlabRay([0,20],[0,0,-5],[0,0,1],slab),[4,6]);assert.equal(clipSlabRay([0,20],[0,0,1],[1,0,0],slab),null);assert.equal(clipSlabRay([0,20],[0,0,3],[0,0,1],slab),null);
 assert.deepEqual(clipSlabRay([2,12],[0,0,0],[0,0,1]),[2,12]);assert.throws(()=>slabDomain(2,1,1));
});
