import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compare, tolerances } from './compare.mts';
import { cases, parseCase, vector, assertQueryCoverage, queryGrid } from './cases.mts';
import { readPointing, camera } from './candidate.mts';
import { verifyOracleBytes, readOracleFixture, ORACLE_ROOT } from '../fixture.mts';
import { pin } from './runtime.mts';
import { nativeArray, call, construct } from './java.mts';

const definitions=await cases();
test('native fixture compares complete source, pointing, image and visibility stages',async()=>{
  const selected=process.env.SBMT_TEST_UNIT==='1'?definitions.filter(c=>c.shape.startsWith('tests/fixtures/')).map(c=>c.id):undefined;
  const report=await compare(selected);
  assert.equal(report.cases.length,selected?.length??definitions.length);
  for(const c of report.cases){
    for(const stage of c.stages.filter(s=>s.name!=='in-image-UV'))assert.equal(stage.status,'match',`${c.id}: ${JSON.stringify(stage)}`);
    assert.ok(c.hits>0&&c.misses>0&&c.occluded>0&&c.outside>0&&c.behind===7);
    assert.ok(c.nativeFootprintCells>0);
    const uv=c.stages.find(s=>s.name==='in-image-UV')!;
    // Keep the preselected quarter-pixel criterion. Native SBMT's angular UV
    // approximation is NOT identical to the pinhole camera used by cssEarth.
    if(c.id==='itokawa-sum'){
      assert.equal(uv.status,'different');assert.ok(uv.maximumError>1);
      assert.equal(c.status,'different');
    }
    if(c.id.startsWith('eros-'))assert.equal(uv.status,'match');
  }
});

test('case contract rejects missing, ambiguous, excessive and unsupported input combinations',()=>{
  const c=definitions[0];
  for(const patch of [{width:0},{height:1},{width:NaN},{width:1e9},{faces:1e9},{format:'spice'},
    {image:'../source.fit'},{shape:'/tmp/model.tab'},{pointing:'src/objects/eros/source/../other.sum'},
    {distortion:'guess'},{rotation:45},{id:'../escape'},{width:undefined}])assert.throws(()=>parseCase({...c,...patch}));
  const probes=queryGrid().map(fraction=>({fraction}));
  assert.doesNotThrow(()=>assertQueryCoverage(probes));
  assert.throws(()=>assertQueryCoverage(probes.slice(1)),/Incomplete/);
  assert.throws(()=>assertQueryCoverage([...probes.slice(0,-1),probes[0]]),/duplicate/);
});

test('pointing binding rejects malformed SUM/INFO and unsupported camera corrections',async()=>{
  const c=definitions.find(c=>c.format==='sum')!, text=await readFile(resolve(ORACLE_ROOT,c.pointing),'utf8');
  assert.throws(()=>readPointing(text.split('\n').slice(0,5).join('\n'),c),/Invalid SUM/);
  assert.throws(()=>readPointing(text,{...c,width:c.width+1}),/dimensions/);
  const lines=text.split('\n');
  for(const [index,row] of [[3,'1 0 0'],[9,'1 1 0 0 1 0'],[10,'0 1 0 0'],[5,'0 0 0'],[4,'NaN 0 0']] as const){
    const bad=[...lines];bad[index]=row;assert.throws(()=>readPointing(bad.join('\n'),c));
  }
  const info=definitions.find(c=>c.format==='info')!, infoText=await readFile(resolve(ORACLE_ROOT,info.pointing),'utf8');
  assert.throws(()=>readPointing(infoText.replace('MSI_FRUSTUM4','MISSING'),info),/Missing/);
  assert.throws(()=>readPointing(infoText+'\nSPACECRAFT_POSITION=(0,0,1)',info),/duplicate/);
  assert.throws(()=>camera([0,0,1],[[1,0,0],[1,0,0],[1,0,0]],100,100),/Degenerate/);
});

test('source tampering, unsafe software pins and invalid native values fail before comparison',async()=>{
  const fixture=await readOracleFixture('sbmt/projection.json'), p=fixture.inputs.find(p=>p.path.endsWith('.SUM'))!;
  const bytes=await readFile(resolve(ORACLE_ROOT,p.path)), bad=Buffer.from(bytes);bad[0]^=1;
  assert.throws(()=>verifyOracleBytes(p,bad),/differ/);
  assert.throws(()=>pin({path:'../escape',bytes:1,sha256:'a'.repeat(64)}),/Unsafe/);
  assert.throws(()=>pin({path:'native/x',bytes:-1,sha256:'x'}),/Invalid/);
  assert.throws(()=>vector([1,NaN,2]));assert.throws(()=>vector([1,2]));
  assert.throws(()=>call({},'absent'));assert.throws(()=>construct({}));assert.throws(()=>nativeArray({}));
  assert.deepEqual(nativeArray(new Float32Array([1,2])),[1,2]);
});

test('orientation, origin and units mutations exceed the acceptance criteria',async()=>{
  const c=definitions[0], p=readPointing(await readFile(resolve(ORACLE_ROOT,c.pointing),'utf8'),c);
  const original=camera(p.origin,p.frustum,c.width,c.height), flipped=camera(p.origin,[p.frustum[1],p.frustum[0],p.frustum[3],p.frustum[2]],c.width,c.height);
  const q=p.origin.map((v,i)=>v+p.frustum[0][i]*10);
  assert.ok(Math.abs(original.project(q)[0]-flipped.project(q)[0])>100);
  for(const factor of [-1,1000]){
    const wrong=camera(p.origin.map(v=>factor*v),p.frustum,c.width,c.height);
    assert.ok(Math.hypot(...wrong.project(q).slice(0,2).map((v,i)=>v-original.project(q)[i]))>tolerances.projectionPixels);
  }
});

test('reference generator does not import candidate projection, mesh or FITS implementations',async()=>{
  const source=await readFile(resolve(import.meta.dirname,'projection.mts'),'utf8');
  for(const owner of ['candidate.mts','obj-shape.mts','osiris-geo.mts','tools/fits/fits.mts','compare.mts'])assert.ok(!source.includes(owner),owner);
});
