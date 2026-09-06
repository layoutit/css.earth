import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPagePublication} from './prepared-map/page-publication.mjs';
const limits={pages:8,bytes:8*4};
const group=(key,lineage=[key],pages=[`${key}-image`])=>({key,lineage,pages});
const slots=(g,{published=false,ready=true}={})=>g.pages.map(key=>({key,group:g,published,ready,decodedBytes:4}));
test('a slow unrelated tile does not withhold a completely decoded tile group',()=>{
 const a=group('a',['a'],['apron','strip']),b=group('b');
 const state=[...slots(a),...slots(b,{ready:false})];
 assert.deepEqual(selectPagePublication([a,b],state,limits),{publish:a.pages,release:[]});
 state[1].ready=false;
 assert.deepEqual(selectPagePublication([a,b],state,limits),{publish:[],release:[]});
});
test('a covering parent remains until every selected child and piece is ready',()=>{
 const parent=group('p'),a=group('a',['p','a']),b=group('b',['p','b']);
 const state=[...slots(parent,{published:true}),...slots(a),...slots(b,{ready:false})];
 assert.deepEqual(selectPagePublication([a,b],state,limits),{publish:[],release:[]});
 state.at(-1).ready=true;
 assert.deepEqual(selectPagePublication([a,b],state,limits),{publish:[...a.pages,...b.pages],release:parent.pages});
});
test('a decoded parent replaces old detail while a different region still loads',()=>{
 const parent=group('p'),a=group('a',['p','a']),b=group('b',['p','b']),other=group('other');
 const state=[...slots(a,{published:true}),...slots(b,{published:true}),...slots(parent),...slots(other,{ready:false})];
 assert.deepEqual(selectPagePublication([parent,other],state,limits),{publish:parent.pages,release:[...a.pages,...b.pages]});
});
test('an interrupted pan retires unrelated groups and keeps incomplete replacement coverage',()=>{
 const old=group('old'),parent=group('p'),child=group('c',['p','c']),newRegion=group('new');
 const state=[...slots(old,{published:true}),...slots(parent,{published:true}),...slots(child,{ready:false}),...slots(newRegion)];
 assert.deepEqual(selectPagePublication([child,newRegion],state,limits),{publish:newRegion.pages,release:old.pages});
});
test('local swaps keep a complete half-pool free for the next camera view',()=>{
 const a=group('a'),b=group('b'),a1=group('a1',['a','a1']),a2=group('a2',['a','a2']),parent=group('root');
 const oldB=group('b',['root','b']);
 const state=[...slots(a,{published:true}),...slots(oldB,{published:true}),...slots(a1),...slots(a2),...slots(parent,{ready:false})];
 assert.deepEqual(selectPagePublication([a1,a2,parent],state,{pages:2,bytes:32}),{publish:[],release:[]});
 // A subsequent coarser selection still fits with the old covering cut.
 const newA=group('rootA',['rootA'],['new-a']);state.push(...slots(newA));
 assert.deepEqual(selectPagePublication([newA,parent],state,{pages:2,bytes:32}),{publish:newA.pages,release:a.pages});
});
test('decoded byte limits also bound the displayed cut independently of slot count',()=>{
 const a=group('a'),a1=group('a1',['a','a1']),a2=group('a2',['a','a2']);
 const state=[...slots(a,{published:true}),...slots(a1),...slots(a2)];
 assert.deepEqual(selectPagePublication([a1,a2],state,{pages:8,bytes:4}),{publish:[],release:[]});
});
test('the same tile keeps already published pieces while a newly visible piece loads',()=>{
 const old=group('a',['a'],['one']),next=group('a',['a'],['one','two']);
 const state=[...slots(old,{published:true}),{...slots(next,{ready:false})[1]}];
 assert.deepEqual(selectPagePublication([next],state,limits),{publish:[],release:[]});
 state[1].ready=true;
 assert.deepEqual(selectPagePublication([next],state,limits),{publish:['one','two'],release:[]});
});

test('unknown metadata holds its covering group without blocking another region',()=>{
 const parent=group('p'),a=group('a',['p','a']),other=group('other');
 const pending={key:'b',lineage:['p','b'],pages:[],pending:true};
 const state=[...slots(parent,{published:true}),...slots(a),...slots(other)];
 assert.deepEqual(selectPagePublication([a,pending,other],state,limits),{publish:other.pages,release:[]});
 // Once metadata proves that branch empty, the known child is a complete cut.
 assert.deepEqual(selectPagePublication([a,other],state,limits),{publish:[...a.pages,...other.pages],release:parent.pages});
});

test('an evicted metadata branch preserves old detail until known or offscreen',()=>{
 const old=group('detail',['root','branch','detail']);
 const pending={key:'branch',lineage:['root','branch'],pages:[],pending:true};
 const state=slots(old,{published:true});
 assert.deepEqual(selectPagePublication([pending],state,limits),{publish:[],release:[]});
 assert.deepEqual(selectPagePublication([],state,limits),{publish:[],release:old.pages});
});
