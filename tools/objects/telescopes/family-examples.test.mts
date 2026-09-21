import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {executableFamilyOperations} from './family-operation.mts';
import {parseProductDescriptor} from './product-descriptor.mts';

const root=resolve(import.meta.dirname,'../../..'),base=resolve(root,'tools/objects/telescopes/examples/family-examples');
const assigned=['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'];
const sha256=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('checked family examples contain exactly one pinned representative per assigned family',async()=>{
  const manifest=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8')) as any;
  assert.equal(manifest.schema,'cssearth-telescope-family-examples@1');
  assert.deepEqual(manifest.examples.map((entry:any)=>entry.family),assigned);
  assert.equal(new Set(manifest.examples.map((entry:any)=>entry.family)).size,assigned.length);
  assert.deepEqual((await readdir(resolve(base,'artifacts'))).sort(),assigned.map(family=>manifest.examples.find((entry:any)=>entry.family===family).artifact.path.split('/').at(-1)).sort());
  for(const example of manifest.examples){
    assert.equal(example.exampleProven,true);
    assert.equal(example.proposalBaseline.status,'complete');
    assert.ok(Array.isArray(example.proposalBaseline.requiredCases));
    for(const key of ['owner','independentCheck','limit'])assert.ok(typeof example[key]==='string'&&example[key].length>0);
    for(const pin of [example.source,example.artifact]){const file=resolve(pin===example.source?root:base,pin.path),bytes=await readFile(file);assert.equal(bytes.length,pin.bytes,`${example.family} ${pin.path} bytes`);assert.equal(sha256(bytes),pin.sha256,`${example.family} ${pin.path} hash`);}
    assert.match(example.source.url,/^https:\/\//u);
    assert.equal((await stat(resolve(root,example.productRecordReadback.test))).isFile(),true);
    assert.equal((await stat(resolve(root,example.independentCheck))).isFile(),true);
    assert.doesNotMatch(JSON.stringify(example),/\/Users\/|file:\/\//u);
    const tokens=example.command.split(' ');assert.equal(tokens[0],'telescope');assert.ok(tokens.includes('--out'));assert.doesNotMatch(example.command,/[;&|`$]/u);
    if(example.family==='F01')assert.equal(tokens[1],'export');
    else{
      assert.equal(tokens[1],'family-run');const descriptorPath=tokens[2],operationId=tokens[3],descriptor=parseProductDescriptor(JSON.parse(await readFile(resolve(root,descriptorPath),'utf8')));
      assert.deepEqual(descriptor.dataset.families,[example.family]);assert.ok(executableFamilyOperations(descriptor).some(operation=>operation.id===operationId&&operation.available),`${example.family} ${operationId} executable`);
      for(const member of descriptor.members){const file=resolve(resolve(root,descriptorPath),'..',member.path),bytes=await readFile(file);assert.equal(bytes.length,member.bytes);assert.equal(sha256(bytes),member.sha256);}
      const params=tokens.indexOf('--params');if(params>=0){const value=JSON.parse(await readFile(resolve(root,tokens[params+1]!),'utf8'));assert.equal(value.operationId,operationId);}
    }
  }
  assert.deepEqual(manifest.examples.find((entry:any)=>entry.family==='F02').proposalBaseline.requiredCases,['mixed time/spectral/polarization slicing']);
  assert.deepEqual(manifest.examples.find((entry:any)=>entry.family==='F14').proposalBaseline.requiredCases,['HEALPix map ingest/export']);
});
