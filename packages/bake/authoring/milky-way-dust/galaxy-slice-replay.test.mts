import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {GALAXY_SLICES} from './galaxy-slice-source.mts';
import {REPLAY_FIXTURE} from './galaxy-slice-replay-fixture.mts';
import {parseGalaxySliceControls} from './slice-galaxy.mts';

test('default outside recipe replays the step-one accepted producer byte for byte',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'galaxy-default-replay-'));
 try{
  writeFileSync(dir+'/slices.py',process.env.CSSEARTH_SLAB_MUTATION_SOURCE?readFileSync(process.env.CSSEARTH_SLAB_MUTATION_SOURCE,'utf8'):GALAXY_SLICES);
  writeFileSync(dir+'/fixture.py',REPLAY_FIXTURE);
  const controls=parseGalaxySliceControls({mode:'outside-display',counts:'2,2,2'});
  const run=spawnSync(process.env.CSSEARTH_TORCH_PYTHON??'python3',[dir+'/fixture.py',dir,dir+'/slices.py',JSON.stringify(controls)],{encoding:'utf8',timeout:60_000});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const expected=new URL('./fixtures/galaxy-slice-replay/',import.meta.url);
  for(const axis of 'xyz')for(const file of readdirSync(new URL(axis+'/',expected)))assert.deepEqual(readFileSync(dir+'/out/'+axis+'/'+file),readFileSync(new URL(axis+'/'+file,expected)),axis+'/'+file);
  for(const file of readdirSync(expected).filter(file=>file.endsWith('.png')))assert.deepEqual(readFileSync(dir+'/out/'+file),readFileSync(new URL(file,expected)),file);
  // Ordering of os.walk is filesystem-owned; every metadata value is pinned.
  const normalize=(text:string)=>{const data:unknown=JSON.parse(text);assert.ok(data&&typeof data==='object'&&'files' in data&&Array.isArray(data.files));data.files.sort((a:unknown,b:unknown)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return data;};
  assert.deepEqual(normalize(readFileSync(dir+'/out/prototype.json','utf8')),normalize(readFileSync(new URL('prototype.json',expected),'utf8')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
