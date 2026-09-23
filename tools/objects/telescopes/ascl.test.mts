import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { writeProductRecord } from '../product-record.mts';
import { matchProductSoftware, searchAscl } from './ascl.mts';
import { main, parseCli } from './cli.mts';

const rows={
  1:{ascl_id:'1708.004',title:'Astroquery: Access to online data resources',abstract:'Query archives.',site_list:['https://github.com/astropy/astroquery'],preferred_citation:'Cite the Astroquery paper.'},
  2:{ascl_id:'1304.002',title:'Astropy: Community Python library for astronomy',site_list:[]},
  3:{ascl_id:'2502.014',title:'spaceKLIP: JWST coronagraphy pipeline',site_list:[]},
  4:{ascl_id:'bad',title:'Invalid',site_list:[]},
};
const response=async()=>new Response(JSON.stringify(rows),{headers:{'content-type':'application/json'}});

test('ASCL title search returns catalog provenance and bounded, validated entries',async()=>{
  const result=await searchAscl('astro',response);
  assert.deepEqual(result.entries?.map(item=>item.id),['1304.002','1708.004']);
  assert.equal(result.entries?.[1]?.preferredCitation,'Cite the Astroquery paper.');
  assert.match(result.sourceSha256,/^[0-9a-f]{64}$/u);
  assert.match(result.caveat,/not show that code ran/u);
  assert.equal((await searchAscl('absent',response)).entries?.length,0);
  await assert.rejects(searchAscl('x',response),/at least two/u);
});

test('verified product software matches exact ASCL alias and never invents use',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'ascl-product-'));
  try{
    const file=resolve(root,'data.txt'),receipt=resolve(root,'data.product.json');await writeFile(file,'science');
    await writeProductRecord(receipt,{telescope:'fixture',stage:'fixture',inputs:[],parameters:{},software:[
      {name:'Astroquery',version:'0.4.11'},{name:'Astropy',version:'7.0'},{name:'cssEarth archive source',version:'fixture'}]},[{path:'data.txt',file}]);
    const result=await matchProductSoftware(receipt,response);
    assert.deepEqual(result.software?.map(item=>item.matches.map(match=>match.id)),[['1708.004'],['1304.002'],[]]);
    assert.match(result.caveat,/does not verify the software version/u);
    await writeFile(file,'altered');
    await assert.rejects(matchProductSoftware(receipt,response),/pins changed/u);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('ASCL CLI distinguishes title and verified-product lookup without prompts',async()=>{
  assert.deepEqual(parseCli(['ascl','Astroquery','--json']),{command:'ascl',query:'Astroquery',json:true,verbose:false});
  assert.equal(parseCli(['ascl','--product','receipt.json']).command,'ascl');
  assert.throws(()=>parseCli(['ascl','Astroquery','--product','receipt.json']),/Use telescope ascl/u);
  assert.throws(()=>parseCli(['ascl']),/Use telescope ascl/u);
  const text:string[]=[],io={stdinIsTTY:false,stdoutIsTTY:false,write:(value:string)=>text.push(value),error:(value:string)=>text.push(value),question:async()=>undefined,close:()=>{}};
  const original=globalThis.fetch;globalThis.fetch=response as typeof fetch;
  try{assert.equal(await main(['ascl','Astroquery','--json'],undefined,value=>text.push(value),io),0);assert.equal(JSON.parse(text.join('')).entries[0].id,'1708.004');}
  finally{globalThis.fetch=original;}
});
