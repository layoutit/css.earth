import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPagePublication, selectPageFallbacks, usefulFallbacks, selectPageDemand} from './prepared-map/page-publication.mjs';
const limits={pages:8,bytes:8*4};
const group=(key,lineage=[key],pages=[`${key}-image`])=>({key,lineage,pages});
const slots=(g,{published=false,ready=true}={})=>g.pages.map(key=>({key,group:g,published,ready,decodedBytes:4}));
test('prepared backing retires with its own ready region while a neighbour remains delayed',()=>{
 const a=group('fine-a',['fine-a'],['a-1','a-2']),b=group('fine-b'),c=group('unrelated');
 const backA={...group('back-a'),backing:true,replacements:[a.key]},backB={...group('back-b'),backing:true,replacements:[b.key]};
 const state=[...slots(backA,{published:true}),...slots(backB,{published:true}),...slots(a),...slots(b,{ready:false}),...slots(c)];
 const result=selectPagePublication([backA,backB,a,b,c],state,{pages:4,bytes:16});
 assert.deepEqual(result.release,backA.pages);
 assert.ok([...a.pages,...c.pages].every(key=>result.publish.includes(key)));
 assert.ok(!result.publish.includes(b.pages[0]));
});
test('one ready fine group can reclaim several overlapping backing pages atomically at a full display limit',()=>{
 const fine=group('fine',['fine'],['one','two','three']);
 const backing=['a','b','c'].map(key=>({...group(key),backing:true,replacements:[fine.key]}));
 const state=[...backing.flatMap(g=>slots(g,{published:true})),...slots(fine)];
 assert.deepEqual(selectPagePublication([...backing,fine],state,{pages:3,bytes:12}),{publish:fine.pages,release:backing.flatMap(g=>g.pages)});
 state.at(-1).ready=false;
 assert.deepEqual(selectPagePublication([...backing,fine],state,{pages:3,bytes:12}).release,[]);
});
test('a reversal uses the current backing replacement keys and retains an ancestor under a missing new sibling',()=>{
 const old={...group('root'),backing:true,replacements:['stale-fine']},a=group('new-fine');
 const child={...group('child',['root','child']),backing:true,replacements:[a.key]};
 const pending={key:'sibling',lineage:['root','sibling'],pages:[],pending:true,backing:true};
 const state=[...slots(old,{published:true}),...slots(a),...slots(group('stale-fine'))];
 assert.deepEqual(selectPagePublication([child,pending,a],state,limits).release,[]);
 assert.deepEqual(selectPagePublication([child,a],state,limits).release,old.pages);
});
test('optional backing cannot consume slots or bytes reserved for the complete incoming fine cut',()=>{
 const fine=group('fine',['fine'],['one','two']),back={...group('back'),backing:true,replacements:[fine.key]};
 const old=group('old',['old'],['old-one','old-two']),state=slots(old,{published:true});
 const nodes=new Map([...fine.pages,...back.pages].map(key=>[key,{width:1,height:1}]));
 assert.deepEqual(selectPageDemand([back,fine],state,nodes,{pages:4,bytes:16}),fine.pages);
 assert.deepEqual(selectPageDemand([back,fine],[],nodes,{pages:4,bytes:16}),[...back.pages,...fine.pages]);
 assert.deepEqual(selectPageDemand([back,fine],slots(fine),nodes,{pages:4,bytes:16}),fine.pages);
 assert.deepEqual(selectPageDemand([back,fine],[],nodes,{pages:4,bytes:8}),fine.pages);
});
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
 assert.deepEqual(selectPagePublication([a,b],state,limits),{publish:a.pages,release:[]});
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
 assert.deepEqual(selectPagePublication([a,pending,other],state,limits),{publish:[...a.pages,...other.pages],release:[]});
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

const parent = group('parent'), children = ['a','b','c','d'].map(key => group(key,['parent',key]));
const coverageNodes = () => new Map([parent,...children].flatMap(g => [
 [g.key,{key:g.key,pages:g.pages}], ...g.pages.map(key => [key,{key,width:1,height:1}])
]));
const coverageLimits = {pages:8,bytes:32}, visible = () => true;

test('a prepared transparent ancestor cannot consume a fallback reservation',()=>{
 const nodes=coverageNodes();nodes.get(parent.key).replacement={empty:true,branches:[]};
 assert.deepEqual(selectPageFallbacks(children,nodes,[],coverageLimits,visible),[]);
});

test('a cold detail view loads one affordable ancestor without loading every level',()=>{
 const fallbacks=selectPageFallbacks(children,coverageNodes(),[],coverageLimits,visible);
 assert.deepEqual(fallbacks,[parent]);
 const state=[...slots(parent),...children.flatMap(g=>slots(g,{ready:false}))];
 assert.deepEqual(selectPagePublication(children,state,{pages:4,bytes:16},fallbacks),{publish:parent.pages,release:[]});
 state[0].published=true;state[1].ready=true;
 assert.deepEqual(selectPagePublication(children,state,{pages:4,bytes:16},fallbacks),{publish:[...children[0].pages,...parent.pages],release:[]});
 state.forEach(slot=>slot.ready=true);
 assert.deepEqual(usefulFallbacks(children,state,fallbacks),[]);
 assert.deepEqual(selectPagePublication(children,state,{pages:4,bytes:16},fallbacks),{publish:children.flatMap(g=>g.pages),release:parent.pages});
});

test('ancestor demand yields to already displayed descendants or a cheaper direct image',()=>{
 const state=slots(children[0],{published:true});
 assert.deepEqual(selectPageFallbacks(children,coverageNodes(),state,coverageLimits,visible),[]);
 assert.deepEqual(selectPageFallbacks([children[0]],coverageNodes(),[],coverageLimits,visible),[]);
});

test('cold fallback admission includes all desired images and old visible reservations',()=>{
 const old=group('old'),state=slots(old,{published:true});
 assert.deepEqual(selectPageFallbacks(children,coverageNodes(),state,{pages:5,bytes:32},visible),[]);
 assert.deepEqual(selectPageFallbacks(children,coverageNodes(),state,{pages:8,bytes:20},visible),[]);
 assert.deepEqual(selectPageFallbacks(children,coverageNodes(),state,coverageLimits,visible),[parent]);
});

test('known ancestor covers unknown metadata without blocking an unrelated region',()=>{
 const pending={key:'pending',lineage:['parent','pending'],pages:[],pending:true},other=group('other');
 const nodes=coverageNodes();nodes.set('other-image',{width:1,height:1});
 const fallbacks=selectPageFallbacks([pending,other],nodes,[],coverageLimits,visible);
 assert.deepEqual(fallbacks,[parent]);
 assert.deepEqual(selectPagePublication([pending,other],[...slots(parent),...slots(other)],{pages:4,bytes:16},fallbacks),{publish:[...other.pages,...parent.pages],release:[]});
});

test('failed fallback does not prevent fine images publishing or become an automatic retry',()=>{
 const state=[...slots(parent,{ready:false}),...children.flatMap(g=>slots(g))];
 assert.deepEqual(usefulFallbacks(children,state,[parent]),[]);
 assert.deepEqual(selectPagePublication(children,state,{pages:4,bytes:16},[parent]),{publish:children.flatMap(g=>g.pages),release:[]});
});

test('reversal discards a cold fallback outside the new desired coverage',()=>{
 const other=group('other'),state=slots(parent,{published:true});
 assert.deepEqual(usefulFallbacks([other],state,[parent]),[]);
 assert.deepEqual(selectPagePublication([other],state,{pages:4,bytes:16},[parent]),{publish:[],release:parent.pages});
});

test('progressive detail preserves its covering parent within both displayed limits',()=>{
 const a=group('a',['parent','a'],['a-one','a-two']),b=group('b',['parent','b']);
 const state=[...slots(parent,{published:true}),...slots(a),...slots(b,{ready:false})];
 assert.deepEqual(selectPagePublication([a,b],state,{pages:2,bytes:16}),{publish:[],release:[]});
 assert.deepEqual(selectPagePublication([a,b],state,{pages:4,bytes:8}),{publish:[],release:[]});
 assert.deepEqual(selectPagePublication([a,b],state,{pages:3,bytes:12}),{publish:a.pages,release:[]});
 state[1].published=true;state[2].published=true;
 // The pending sibling cannot cause published child images to disappear.
 assert.deepEqual(selectPagePublication([a,b],state,{pages:3,bytes:12}),{publish:a.pages,release:[]});
 state.at(-1).ready=true;
 assert.deepEqual(selectPagePublication([a,b],state,{pages:3,bytes:12}),{publish:[...a.pages,...b.pages],release:parent.pages});
});
