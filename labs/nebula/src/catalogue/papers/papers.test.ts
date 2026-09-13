import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { paperEndpoint, paperRoot, paperSchema, readPaperIndex, readPaperPage, type Paper, type PaperIndex } from './types';
import { papersFromRows, papersQuery, readPaperCounts } from './query';
import { paperLinks, selectPapers, titleNamesObject, topicsForPaper } from './selection';
import { loadPaperIndex, loadPapers, sha256 } from './load';
import type { MessierObject } from '../types';

const object:MessierObject={id:'m42',messier:42,name:'Orion Nebula',aliases:['NGC 1976'],type:'nebula',raDegrees:83.82,decDegrees:-5.38,majorArcmin:60,minorArcmin:60,sourceIds:[]};
const paper:Paper={bibcode:'2009AJ....137.3675O',title:'The three-dimensional structure of the Orion Nebula.',year:2009,journal:'AJ',doi:'10.1088/0004-6256/137/2/3675',abstract:'Doppler velocities and dust extinction constrain the morphology.',objectNames:'Orion Nebula'};
const hash='a'.repeat(64), now='2026-09-13T00:00:00Z';
function page(){return {schema:paperSchema,objectId:'m42',simbadId:'M  42',retrievedAt:now,query:papersQuery('M  42',10),sourceSha256:hash,expectedCount:1,papers:[paper]};}
function index():PaperIndex{return {schema:'cssearth-messier-paper-index@1',catalogueSha256:hash,generatedAt:now,countQuery:'query',countSourceSha256:hash,
  objects:Array.from({length:110},(_,i)=>({objectId:`m${i+1}`,simbadId:`M ${i+1}`,expectedCount:0,count:0,status:'pending'}))};}
test('canonical padded SIMBAD IDs are retained; duplicate/missing Messier identities fail',()=>{
  const metadata=[{name:'messier_id'},{name:'ref_count'}],data=Array.from({length:110},(_,i)=>[`M ${String(i+1).padStart(3)}`,i]);
  const counts=readPaperCounts({metadata,data});assert.equal(counts[41]!.objectId,'m42');assert.equal(counts[41]!.simbadId,'M  42');
  assert.throws(()=>readPaperCounts({metadata,data:data.slice(1)}));
  assert.throws(()=>readPaperCounts({metadata,data:[...data.slice(1),data[1]]}));
  assert.match(papersQuery('M  42',5),/i.id='M  42'/);assert.throws(()=>papersQuery("M 42' OR 1=1",5));
});
test('source metadata remains intact and missing abstracts stay missing',()=>{
  const p=papersFromRows([{bibcode:paper.bibcode,title:paper.title,pubyear:2009,journal:'AJ',doi:null,abstract:null,ref_raw_id:'M42'}])[0]!;
  assert.equal(p.abstract,null);assert.equal(p.doi,null);assert.equal(p.objectNames,'M42');
  assert.throws(()=>readPaperPage({...page(),papers:[paper,paper]}));
  assert.throws(()=>readPaperPage({...page(),objectId:'m31'}));
  assert.throws(()=>readPaperIndex({...index(),objects:index().objects.map((o,i)=>i?o:{...o,status:['complete']})}));
});
test('object title priority is distinct from incidental bibliography membership and keyword topics',()=>{
  const incidental={...paper,bibcode:'2026AJ....137.3675O',year:2026,title:'A survey of many galaxies',abstract:null};
  assert.equal(selectPapers([incidental,paper],object,'','all','object',null)[0],paper);
  assert.equal(selectPapers([incidental,paper],object,'','all','newest',null)[0],incidental);
  assert.equal(titleNamesObject({...paper,title:'M420 morphology'},object),false);
  assert.equal(titleNamesObject({...paper,title:'M42 morphology'},object),true);
  assert.ok(topicsForPaper(paper).includes('Kinematics'));assert.ok(topicsForPaper(paper).includes('Structure'));
  assert.equal(selectPapers([paper],object,'Doppler','Kinematics','object',2010).length,0);
  assert.equal(selectPapers([paper],object,'Doppler','Kinematics','object',2000).length,1);
});
test('external links encode identifiers and never infer an available PDF',()=>{
  assert.match(paperLinks(paper).doi!,/^https:\/\/doi\.org\//);
  assert.equal(paperLinks({...paper,doi:'javascript:alert(1)'}).doi,null);
  assert.equal(paperLinks(paper).arxiv,null);
  assert.equal(paperLinks({...paper,bibcode:'2026arXiv260600066R'}).arxiv,'https://arxiv.org/abs/2606.00066');
});
test('loaded compressed pages must pass hash, byte count and object identity before display',async()=>{
  const original=globalThis.fetch;
  const bytes=Uint8Array.from(gzipSync(JSON.stringify(page()))),digest=await sha256(bytes.buffer);
  const ref={objectId:'m42',simbadId:'M  42',count:1,expectedCount:1,status:'complete' as const,path:`${paperRoot}/m42-${digest}.json.gzip`,sha256:digest,bytes:bytes.byteLength};
  globalThis.fetch=async()=>new Response(bytes);
  try{
    assert.equal((await loadPapers(ref,p=>p,new AbortController().signal))!.papers[0]!.title,paper.title);
    await assert.rejects(()=>loadPapers({...ref,sha256:hash},p=>p,new AbortController().signal),/integrity/);
    await assert.rejects(()=>loadPapers({...ref,objectId:'m31'},p=>p,new AbortController().signal),/selected object/);
    globalThis.fetch=async()=>Response.json(index());
    await assert.rejects(()=>loadPaperIndex(p=>p,'b'.repeat(64),new AbortController().signal),/different object catalogue/);
    assert.equal((await loadPaperIndex(p=>p,hash,new AbortController().signal))!.objects.length,110);
  }finally{globalThis.fetch=original;}
  assert.ok(paperEndpoint.startsWith('https://simbad.'));
});
