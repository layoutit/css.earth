import test from 'node:test';
import assert from 'node:assert/strict';
import { readFusionRequest, readFusionResult } from './jobs-model.ts';
const request=()=>({action:'apply',imageId:'joint-evidence',cataloguePath:'.local/nebula-lab/observations/object/structures/catalogue.json',imageToFrame:{a:[1,0,0,1,0,0]},settings:{channel:'ridges',weights:[1,1,1],sensitivity:1}});
test('combined evidence boundary rejects escaped paths, singular registrations and unbounded settings',()=>{
 assert.equal(readFusionRequest(request()).settings.channel,'ridges');
 for(const patch of [{cataloguePath:'.local/nebula-lab/../private'},{imageId:'other'},{imageToFrame:{a:[1,1,1,1,0,0]}},{settings:{channel:'ridges',weights:[1,1],sensitivity:Infinity}},{settings:{channel:'depth',weights:[1,1],sensitivity:1}}])assert.throws(()=>readFusionRequest({...request(),...patch}));
});
test('prepared evidence requires finite dimensions, source ownership and hashed local assets',()=>{
 const asset={path:'.local/nebula-lab/evidence-fusion/results/test.png',sha256:'a'.repeat(64)};
 const value={schema:'cssearth-joint-evidence@1',id:'b'.repeat(64),inputIdentity:'c'.repeat(64),preparationVersion:'test',width:16,height:16,settings:{channel:'all',weights:[1,1],sensitivity:1},sources:['a','b'].map(id=>({id,label:id,color:'#aabbcc',source:asset,evidence:asset})),union:asset,agreement:asset,colors:asset,samples:asset};
 assert.equal(readFusionResult(value).sources.length,2);
 for(const patch of [{width:NaN},{width:200000},{sources:[value.sources[0],value.sources[0]]},{sources:[value.sources[0]]},{union:{...asset,sha256:'missing'}},{samples:{...asset,path:'../escaped'}}])assert.throws(()=>readFusionResult({...value,...patch}));
});
