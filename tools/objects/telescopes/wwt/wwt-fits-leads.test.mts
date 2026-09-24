import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadWwtFitsLeads, resolveWwtFitsLead } from './wwt-fits-leads.mts';
import { parseCli } from '../cli.mts';

test('M31 exploration links the pinned PHAT FITS collection without treating tiles as observations',async()=>{
  const root=resolve(import.meta.dirname,'../../../..'),m31=await loadWwtFitsLeads(root,{id:'m31',name:'Andromeda Galaxy',aliases:['M31']});
  assert.equal(m31.state,'indexed');if(m31.state!=='indexed')return;
  assert.deepEqual(m31.matches.map(row=>row.imageset),['PHAT-f475w','PHAT-f814w']);
  assert.ok(m31.matches.every(row=>row.catalogSha256.length===64&&row.evidence==='https://archive.stsci.edu/hlsp/phat'));
  const unrelated=await loadWwtFitsLeads(root,{id:'betelgeuse',name:'Betelgeuse',aliases:[]});
  assert.equal(unrelated.state,'indexed');if(unrelated.state==='indexed')assert.equal(unrelated.matches.length,0);
  const scratch=await mkdtemp(resolve(tmpdir(),'wwt-fits-leads-'));
  try{
    const path=resolve(scratch,'explore.json'),saved={schema:'cssearth-telescope-exploration@1',target:'m31',answer:{target:'m31',wwtFits:m31}};
    await writeFile(path,JSON.stringify(saved));
    assert.deepEqual(await resolveWwtFitsLead(root,path,2),{catalog:resolve(root,'data/wwt/phat-fits.json'),imageset:'PHAT-f814w'});
    await writeFile(path,JSON.stringify({...saved,answer:{...saved.answer,wwtFits:{...m31,matches:m31.matches.map(row=>({...row,catalogSha256:'0'.repeat(64)}))}}}));
    await assert.rejects(resolveWwtFitsLead(root,path,1),/changed; explore again/u);
    await writeFile(path,JSON.stringify({...saved,answer:{...saved.answer,wwtFits:{...m31,matches:m31.matches.map(row=>({...row,sourceUrl:'https://example.org/changed'}))}}}));
    await assert.rejects(resolveWwtFitsLead(root,path,1),/changed; explore again/u);
    await assert.rejects(resolveWwtFitsLead(root,path,3),/between 1 and 2/u);
  }finally{await rm(scratch,{recursive:true,force:true});}
  assert.equal(parseCli(['wwt-fits','run/explore.json','--pick','1','--level','0','--x','0','--y','0','--out','tile']).command,'wwt-fits');
  assert.throws(()=>parseCli(['wwt-fits','run/explore.json','--pick','1','--set','PHAT-f475w','--level','0','--x','0','--y','0','--out','tile']),/Use telescope wwt-fits/u);
});
